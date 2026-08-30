import { NextRequest, NextResponse } from "next/server";
import {
  BASE_FEE,
  Keypair,
  Transaction,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import { rpcUrl } from "@/lib/constants/network";
import { serverEnv } from "@/lib/env.server";
import { getAssetsConfig } from "@/lib/constants/assets.config";
import { stellarPriceService } from "@/lib/services/stellar-price.service";
import { BlendPoolAdapter } from "@/lib/orchestrator/adapters/BlendPoolAdapter";
import { PoolRegistry } from "@/lib/orchestrator/core/PoolRegistry";
import { getCoordinatorLedgerStore } from "@/lib/coordinator/ledger";
import {
  reconcileCoordinatorRun,
  runCoordinatorUnwind,
  type CoordinatorExecutionDeps,
  type CoordinatorTransportAdapter,
} from "@/lib/coordinator/execute";
import { selectTranchesToClearBreach } from "@/lib/coordinator/delegation";
import {
  computeGrantRiskSnapshot,
  evaluatePosition,
  type PoolPositionReader,
} from "@/lib/coordinator/deleverageGuard";
import type { DelegationGrant } from "@/lib/coordinator/types";

/**
 * Automated deleveraging guard (Scope §6), cron-triggered like
 * app/api/vault/invest/route.ts. Every tick: reconcile+resume any run left
 * in-progress by a prior crash, then re-evaluate every active grant's live
 * health factor and trigger a bounded partial unwind on breach, strictly
 * within what that position's DelegationGrant authorizes.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 300;

let lastRun = 0;
const COOLDOWN_MS = 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── On-chain reads ───────────────────────────────────────────────────────────

/**
 * Live pool-position reader wired to the real adapters. Blend exposes both
 * collateral and liabilities per reserve (BlendPoolAdapter.getPoolInfo/
 * getUserPosition), so it's read directly. Neko's adapter surface has no
 * debt-read method at all (see NekoLendingAdapter) and its supply-balance
 * read doesn't cleanly distinguish "collateral" from "plain supply" either
 * — rather than fabricate a number for either leg, Neko pools report
 * unreadable (null) here and lib/coordinator/deleverageGuard.ts's documented,
 * safety-biased fallback takes over (collateral defaults to 0 — the
 * conservative direction; debt falls back to the tranche's own known
 * static amount — never silently zeroed).
 */
const readPoolPosition: PoolPositionReader = async (poolId, walletAddress) => {
  if (!poolId.startsWith("blend:")) return null;

  try {
    const rawId = PoolRegistry.stripPrefix(poolId);
    const [poolContractId] = rawId.split(":");
    const adapter = new BlendPoolAdapter(poolContractId);
    const [info, position] = await Promise.all([
      adapter.getPoolInfo(rawId),
      adapter.getUserPosition(rawId, walletAddress),
    ]);
    const decimals = info.tokens[0]?.decimals ?? 7;
    const collateralRaw = BigInt(String(position.metadata.collateral ?? "0"));
    const liabilitiesRaw = BigInt(String(position.metadata.liabilities ?? "0"));
    return {
      collateralUnits: Number(collateralRaw) / 10 ** decimals,
      debtUnits: Number(liabilitiesRaw) / 10 ** decimals,
    };
  } catch {
    return null;
  }
};

async function buildPriceLookup(
  assetCodes: string[]
): Promise<(code: string) => number | null> {
  const assetsConfig = getAssetsConfig();
  const unique = [...new Set(assetCodes)];
  const prices = await Promise.all(
    unique.map((code) =>
      stellarPriceService
        .getPrice(code, assetsConfig[code]?.contract)
        .catch(() => 0)
    )
  );
  const map = new Map<string, number>();
  unique.forEach((code, i) => {
    if (prices[i] > 0) map.set(code, prices[i]);
  });
  return (code: string) => map.get(code) ?? null;
}

// ─── Submission transport ────────────────────────────────────────────────────

function makeTransport(): CoordinatorTransportAdapter {
  return {
    async submit(xdr, np) {
      const server = new rpc.Server(rpcUrl);
      const tx = TransactionBuilder.fromXDR(xdr, np);
      const result = await server.sendTransaction(tx);
      if (result.status !== "PENDING") {
        throw new Error(`Submission rejected with status ${result.status}`);
      }
      return { hash: result.hash };
    },
    async confirm(hash) {
      const server = new rpc.Server(rpcUrl);
      for (let i = 0; i < 25; i++) {
        await sleep(2000);
        const status = await server.getTransaction(hash);
        if (status.status === "SUCCESS") return status;
        if (status.status === "FAILED") {
          throw new Error("Transaction failed on-chain");
        }
      }
      throw new Error("Transaction confirmation timed out");
    },
  };
}

/**
 * Wraps an already wallet-signed inner transaction in a fresh fee-bump
 * envelope, mirroring VAULT_MANAGER_SECRET_KEY's role in
 * app/api/vault/invest/route.ts — this key only ever pays and relays a fee
 * bump; it never signs the inner operation, so it structurally cannot
 * authorize anything the pre-signed tranche didn't already authorize.
 * Falls back to submitting the inner XDR unmodified when the key isn't
 * configured (optional at the schema level, matching every other
 * integration secret in env.server.ts).
 */
async function wrapForSubmission(
  signedInnerXdr: string,
  np: string
): Promise<{ xdr: string }> {
  if (!serverEnv.LEVERAGE_COORDINATOR_SECRET_KEY)
    return { xdr: signedInnerXdr };

  const keypair = Keypair.fromSecret(serverEnv.LEVERAGE_COORDINATOR_SECRET_KEY);
  const inner = TransactionBuilder.fromXDR(signedInnerXdr, np);
  if (!(inner instanceof Transaction)) return { xdr: signedInnerXdr };

  const feeBumpFee = String(Number(BASE_FEE) * 10);
  const feeBump = TransactionBuilder.buildFeeBumpTransaction(
    keypair,
    feeBumpFee,
    inner,
    np
  );
  feeBump.sign(keypair);
  return { xdr: feeBump.toXDR() };
}

async function getTransactionStatus(
  hash: string
): Promise<"SUCCESS" | "FAILED" | "PENDING" | "NOT_FOUND"> {
  const server = new rpc.Server(rpcUrl);
  const result = await server.getTransaction(hash);
  if (result.status === "SUCCESS") return "SUCCESS";
  if (result.status === "FAILED") return "FAILED";
  if (result.status === "NOT_FOUND") return "NOT_FOUND";
  return "PENDING";
}

// ─── One grant's guard tick ───────────────────────────────────────────────────

interface GrantTickResult {
  positionId: string;
  action: string;
  detail?: string;
}

async function tickGrant(
  grant: DelegationGrant,
  deps: CoordinatorExecutionDeps,
  getPrice: (code: string) => number | null
): Promise<GrantTickResult> {
  const store = deps.store;

  const inProgress = await store.findInProgressRunForPosition(grant.positionId);
  if (inProgress) {
    const reconciled = await reconcileCoordinatorRun(inProgress, {
      getTransactionStatus,
    });
    await store.saveRun(reconciled);
    const resumed = await runCoordinatorUnwind(deps, {
      grant,
      selection: {
        trancheIds: reconciled.trancheIdsPlanned,
        steps: [],
      },
      healthFactorAtTrigger: reconciled.healthFactorAtTrigger,
      healthFactorTarget: reconciled.healthFactorTarget,
      existingRun: reconciled,
    });
    return {
      positionId: grant.positionId,
      action: `resumed-run:${resumed.status}`,
    };
  }

  const snapshot = await computeGrantRiskSnapshot(
    grant,
    readPoolPosition,
    getPrice
  );
  const action = evaluatePosition(
    snapshot,
    grant,
    grant.breached,
    grant.guardConfig
  );

  if (action.kind === "recovered") {
    await store.saveGrant({ ...grant, breached: false });
    return { positionId: grant.positionId, action: "recovered" };
  }

  if (action.kind === "hold" || action.kind === "alert-only") {
    return {
      positionId: grant.positionId,
      action: action.kind,
      detail: action.kind === "alert-only" ? action.reason : undefined,
    };
  }

  // trigger-unwind
  if (!grant.breached) {
    await store.saveGrant({ ...grant, breached: true });
  }

  const selection = selectTranchesToClearBreach(
    grant,
    action.requiredDebtReliefUnits
  );
  if (!selection) {
    return {
      positionId: grant.positionId,
      action: "trigger-unwind-no-tranches-left",
    };
  }

  const run = await runCoordinatorUnwind(deps, {
    grant,
    selection,
    healthFactorAtTrigger: snapshot.healthFactor,
    healthFactorTarget: action.targetHealthFactor,
  });

  return { positionId: grant.positionId, action: `unwind:${run.status}` };
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const store = getCoordinatorLedgerStore();
  const grants = await store.listActiveGrants();
  const priceOf = await buildPriceLookup(
    grants.flatMap((g) => [g.assetCode, g.borrowAssetCode])
  );

  const statuses = await Promise.all(
    grants.map(async (grant) => {
      const snapshot = await computeGrantRiskSnapshot(
        grant,
        readPoolPosition,
        priceOf
      );
      return {
        positionId: grant.positionId,
        healthFactor: snapshot.healthFactor,
        deleverageThreshold: grant.guardConfig.deleverageThreshold,
        breached: grant.breached,
        tranchesRemaining:
          grant.tranches.length - grant.consumedTrancheIds.length,
      };
    })
  );

  return NextResponse.json({
    activeGrants: grants.length,
    statuses,
    cooldownRemaining: Math.max(
      0,
      Math.ceil((lastRun + COOLDOWN_MS - Date.now()) / 1000)
    ),
  });
}

export async function POST(request: NextRequest) {
  try {
    const isCron = request.headers.get("x-vercel-cron") === "1";
    if (!isCron) {
      const remaining = lastRun + COOLDOWN_MS - Date.now();
      if (remaining > 0) {
        return NextResponse.json(
          { error: `Please wait ${Math.ceil(remaining / 1000)}s` },
          { status: 429 }
        );
      }
    }
    lastRun = Date.now();

    const store = getCoordinatorLedgerStore();
    const grants = await store.listActiveGrants();
    const priceOf = await buildPriceLookup(
      grants.flatMap((g) => [g.assetCode, g.borrowAssetCode])
    );

    const deps: CoordinatorExecutionDeps = {
      store,
      transports: { rpc: makeTransport(), soroswapApi: makeTransport() },
      wrapForSubmission,
    };

    const results = await Promise.all(
      grants.map((grant) => tickGrant(grant, deps, priceOf))
    );

    return NextResponse.json({ success: true, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
