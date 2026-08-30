import { NextRequest, NextResponse } from "next/server";
import {
  MIN_IDLE_THRESHOLD,
  getVaultManagerEnv,
  buildVaultClient,
} from "@/lib/vault/investSteps";
import {
  runOrResumeVaultInvest,
  getVaultInvestLedgerStatus,
} from "@/lib/vault/investLedger";
import { LeaseNotAcquiredError } from "@/lib/jobs/errors";
import type { JobStep } from "@/lib/jobs/types";
  Keypair,
  TransactionBuilder,
  rpc,
  BASE_FEE,
  Operation,
  Address,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import { clientEnv } from "@/lib/env.client";
import { requireServerEnv } from "@/lib/env.server";
import { reportStageOutcome } from "@/lib/event-platform/vaultStageOutcome";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function stepResult(
  steps: JobStep[],
  kind: string
): Record<string, unknown> | undefined {
  const step = steps.find((s) => s.kind === kind);
  return step?.result ?? undefined;
}

// ─── GET — current vault state ───────────────────────────────────────────────

export async function GET() {
  try {
    const { secretKey, rpcUrl, networkPassphrase } = getVaultManagerEnv();
    const { client } = buildVaultClient(secretKey, rpcUrl, networkPassphrase);

    const fundsTx = await client.fetch_total_managed_funds({ simulate: true });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
    let funds = fundsTx.result as any;
    if (funds?.tag === "ok") funds = funds.value;
    else if (typeof funds?.unwrap === "function") funds = funds.unwrap();

    const idleAmount = Number(BigInt(funds[0].idle_amount.toString())) / 1e7;
    const totalAmount = Number(BigInt(funds[0].total_amount.toString())) / 1e7;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- @neko/defindex-vault doesn't currently resolve (separate pre-existing workspace package-naming issue), so the real SDK types can't be verified here
    const allocations = funds[0].strategy_allocations.map((a: any) => ({
      strategy: a.strategy_address,
      amount: Number(BigInt(a.amount.toString())) / 1e7,
    }));

    const ledgerStatus = await getVaultInvestLedgerStatus();

    return NextResponse.json({
      idle: idleAmount,
      total: totalAmount,
      allocations,
      canInvest:
        BigInt(funds[0].idle_amount.toString()) >= MIN_IDLE_THRESHOLD &&
        ledgerStatus.canInvest,
      cooldownRemaining: ledgerStatus.cooldownRemaining,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ─── POST — invest idle + collect fees (cron or manual) ──────────────────────

export async function POST(request: NextRequest) {
  try {
    const isCron = request.headers.get("x-vercel-cron") === "1";

    if (!isCron) {
      const { canInvest, cooldownRemaining } =
        await getVaultInvestLedgerStatus();
      if (!canInvest) {
        return NextResponse.json(
          { error: `Please wait ${cooldownRemaining}s` },
          { status: 429 }
        );
      }
    }

    const { job, steps } = await runOrResumeVaultInvest();

    const harvest = stepResult(steps, "harvest-aquarius") ?? {
      hash: "",
      status: "not run",
    };
    const invest = stepResult(steps, "invest-idle") ?? {
      invested: false,
      results: [],
      idleAmount: 0,
    };
    const fees = stepResult(steps, "collect-fees") ?? {
      results: [],
      feesCollected: false,
    };
    lastInvest = Date.now();

    const { secretKey, rpcUrl, networkPassphrase } = getEnv();
    const keypair = Keypair.fromSecret(secretKey);
    const server = new rpc.Server(rpcUrl);
    const client = new DefindexVaultClient({
      contractId: VAULT_CONTRACT_ID,
      rpcUrl,
      networkPassphrase,
      publicKey: keypair.publicKey(),
    });

    // 1. Harvest Aquarius AQUA rewards → sends them to the vault
    const harvestResult = await harvestAquarius(
      keypair,
      server,
      networkPassphrase
    );
    await reportStageOutcome(
      "harvestAquarius",
      harvestResult.status !== "SUCCESS",
      harvestResult
    );

    // 2. Invest idle funds (includes any AQUA-converted idle if applicable)
    const investResult = await investIdle(
      client,
      keypair,
      server,
      networkPassphrase
    );
    await reportStageOutcome(
      "investIdle",
      investResult.invested &&
        investResult.results.some((r) => r.status !== "SUCCESS"),
      investResult
    );

    // 3. Collect fees (report → lock → distribute)
    const feesResult = await collectFees(
      client,
      keypair,
      server,
      networkPassphrase
    );
    await reportStageOutcome(
      "collectFees",
      !feesResult.feesCollected,
      feesResult
    );

    const allOk =
      (!investResult.invested ||
        investResult.results.every((r) => r.status === "SUCCESS")) &&
      (feesResult.feesCollected ||
        feesResult.results[0]?.status.startsWith("error"));

    return NextResponse.json(
      { success: job.status === "completed", harvest, invest, fees },
      { status: job.status === "completed" ? 200 : 207 }
    );
  } catch (err) {
    if (err instanceof LeaseNotAcquiredError) {
      return NextResponse.json(
        { error: "An invest cycle is already running" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
