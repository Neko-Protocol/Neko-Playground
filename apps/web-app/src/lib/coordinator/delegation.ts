import { nanoid } from "nanoid";
import { strategyStepRegistry } from "@/lib/strategy/registry";
import type { StrategyStepRegistry } from "@/lib/strategy/registry";
import type { UnwindTranche } from "@/lib/strategy/leverage/buildStrategy";
import type {
  DelegationGrant,
  DelegationTrancheRecord,
  SignedCoordinatorStep,
} from "./types";

export type SignFn = (
  xdr: string,
  options: { networkPassphrase: string; address?: string }
) => Promise<{ signedTxXdr: string }>;

function literalValue(binding: { source: string; value?: unknown }): unknown {
  if (binding.source !== "literal") {
    throw new Error(
      "Unwind tranche steps must be fully literal-bound to be pre-signable — got a stepOutput binding."
    );
  }
  return binding.value;
}

/**
 * Prepares and signs every step of every unwind tranche through the SAME
 * wallet-present SignFn the manual open flow uses (lib/strategy/execution.ts's
 * SignFn shape) — the only time the user's wallet is ever asked to sign
 * these unwind operations is right now, at grant time. What's produced here
 * is the entire universe of what the coordinator will ever be able to
 * submit later; nothing built after this point can extend it.
 */
export async function signUnwindTranches(
  tranches: UnwindTranche[],
  ctx: { userAddress: string; networkPassphrase: string },
  sign: SignFn,
  assetCode: string,
  borrowAssetCode: string,
  registry: StrategyStepRegistry = strategyStepRegistry
): Promise<DelegationTrancheRecord[]> {
  const records: DelegationTrancheRecord[] = [];

  for (const tranche of tranches) {
    const signedSteps: SignedCoordinatorStep[] = [];
    for (const step of tranche.steps) {
      const definition = registry.resolve(step.type, step.protocol);
      const resolvedParams: Record<string, unknown> = {};
      for (const [key, binding] of Object.entries(step.params)) {
        resolvedParams[key] = literalValue(binding);
      }

      const tx = await definition.prepare({
        userAddress: ctx.userAddress,
        networkPassphrase: ctx.networkPassphrase,
        resolvedParams,
        upstreamOutputs: {},
      });
      const signed = await sign(tx.xdr, {
        networkPassphrase: tx.networkPassphrase,
        address: ctx.userAddress,
      });

      signedSteps.push({
        stepId: step.id,
        operationType: step.type === "repay" ? "repay" : "withdrawCollateral",
        protocol: step.protocol,
        poolType: step.protocol === "blend" ? "blend" : "neko",
        assetCode: step.type === "repay" ? borrowAssetCode : assetCode,
        amount: String(resolvedParams.amount),
        submissionMode: definition.submissionMode,
        signedXdr: signed.signedTxXdr,
        networkPassphrase: tx.networkPassphrase,
      });
    }
    records.push({
      id: tranche.id,
      order: tranche.order,
      collateralAmount: tranche.collateralAmount,
      debtAmount: tranche.debtAmount,
      collateralPoolId: tranche.collateralPoolId,
      borrowPoolId: tranche.borrowPoolId,
      steps: signedSteps,
    });
  }

  return records;
}

export interface CreateDelegationGrantInput {
  positionId: string;
  walletAddress: string;
  assetCode: string;
  borrowAssetCode: string;
  tranches: DelegationTrancheRecord[];
  /** How long the pre-signed tranches remain eligible to submit. */
  validityMs: number;
  guardConfig: { deleverageThreshold: number; hysteresis: number };
  now?: number;
}

export function createDelegationGrant(
  input: CreateDelegationGrantInput
): DelegationGrant {
  const now = input.now ?? Date.now();
  return {
    id: nanoid(),
    positionId: input.positionId,
    walletAddress: input.walletAddress,
    assetCode: input.assetCode,
    borrowAssetCode: input.borrowAssetCode,
    status: "active",
    createdAt: now,
    expiresAt: now + input.validityMs,
    tranches: input.tranches,
    consumedTrancheIds: [],
    guardConfig: input.guardConfig,
    breached: false,
  };
}

export function revokeDelegationGrant(
  grant: DelegationGrant,
  now: number = Date.now()
): DelegationGrant {
  return { ...grant, status: "revoked", revokedAt: now };
}

/**
 * Deliberately returns plain `boolean`, not a `grant is DelegationGrant`
 * type predicate — a revoked or expired grant is still structurally a
 * DelegationGrant object (just not usable), so a predicate return type
 * would make TypeScript wrongly narrow the false branch to "must be null"
 * everywhere this is checked with `!isDelegationUsable(grant)`.
 */
export function isDelegationUsable(
  grant: DelegationGrant | null,
  now: number = Date.now()
): boolean {
  return grant != null && grant.status === "active" && now < grant.expiresAt;
}

export interface TrancheSelection {
  trancheIds: string[];
  steps: SignedCoordinatorStep[];
}

/**
 * Picks the SMALLEST prefix (in deleverage order) of unconsumed tranches
 * whose cumulative debt relief clears `requiredDebtReliefUnits` — this is
 * the core "never unwinds more than needed to clear the breach" guarantee
 * (acceptance criteria / Scope §5-6): once the running total reaches the
 * requirement, no further tranche is added, and any tranche already
 * consumed by a prior run is never reselected. Returns null when the grant
 * isn't usable (revoked/expired) or has nothing left to give — the caller
 * (the guard) falls back to alert-only in that case, never to "unwind
 * anyway".
 */
export function selectTranchesToClearBreach(
  grant: DelegationGrant | null,
  requiredDebtReliefUnits: number,
  now: number = Date.now()
): TrancheSelection | null {
  if (!grant || !isDelegationUsable(grant, now)) return null;
  if (requiredDebtReliefUnits <= 0) return null;

  const available = grant.tranches
    .filter((t) => !grant.consumedTrancheIds.includes(t.id))
    .sort((a, b) => a.order - b.order);

  const selected: DelegationTrancheRecord[] = [];
  let cumulative = 0;
  for (const tranche of available) {
    if (cumulative >= requiredDebtReliefUnits) break;
    selected.push(tranche);
    cumulative += Number(tranche.debtAmount);
  }

  if (selected.length === 0) return null;
  return {
    trancheIds: selected.map((t) => t.id),
    steps: selected.flatMap((t) => t.steps),
  };
}
