/**
 * Durable, unattended execution coordinator (issue Scope §5).
 *
 * lib/strategy/execution.ts's ExecutionEngine requires a live wallet
 * SignFn for every step, so it cannot run the automated deleveraging guard
 * (Scope §6) unattended. This module is the alternative execution path for
 * that ONE case: submitting already user-signed, amount-capped,
 * operation-capped "unwind tranches" (see
 * lib/strategy/leverage/buildStrategy.ts's buildUnwindTranches) without a
 * wallet present.
 *
 * The delegation is a set of fully pre-signed transactions collected from
 * the user's wallet at position-open time — never a server-held key that
 * can sign arbitrary operations on the user's behalf. The coordinator's own
 * server keypair (mirroring VAULT_MANAGER_SECRET_KEY's role in
 * app/api/vault/invest/route.ts) only wraps an already-signed inner
 * transaction in a fee-bump envelope and submits it — it structurally
 * cannot construct a new operation, so "never submits outside the granted
 * delegation" is a property of what's submittable, not just a runtime check
 * (the runtime check in execute.ts is a defense-in-depth assertion on top).
 */

import type { PoolType } from "@/lib/orchestrator/types/pool.types";

// ─── Delegation ──────────────────────────────────────────────────────────────

export type CoordinatorOperationType = "repay" | "withdrawCollateral";

/** One already wallet-signed step, ready to submit verbatim — no re-signing, no re-building. */
export interface SignedCoordinatorStep {
  stepId: string;
  /** "repay" or the withdraw leg of a supply(mode=collateral,direction=withdraw) step — audit/display only. */
  operationType: CoordinatorOperationType;
  protocol: string;
  poolType: PoolType;
  assetCode: string;
  /** Decimal-string amount this exact signed step moves — the hard cap the scope assertion checks against. */
  amount: string;
  submissionMode: "rpc" | "soroswapApi";
  signedXdr: string;
  networkPassphrase: string;
}

export interface DelegationTrancheRecord {
  id: string;
  /** Deleverage order: 0 unwinds first (most recently added exposure). */
  order: number;
  collateralAmount: string;
  debtAmount: string;
  /** Orchestrator PoolInfo ids, carried through from the routed loop so a server-side reader (the guard) can look up live on-chain state without the client's localStorage-only Strategy record. */
  collateralPoolId: string;
  borrowPoolId: string;
  steps: SignedCoordinatorStep[];
}

export type DelegationStatus = "active" | "revoked";

export interface DelegationGrant {
  id: string;
  /** The leverage-loop Strategy.id this grant is scoped to — the coordinator never touches any other position. */
  positionId: string;
  walletAddress: string;
  assetCode: string;
  borrowAssetCode: string;
  status: DelegationStatus;
  createdAt: number;
  revokedAt?: number;
  /**
   * Unix ms after which the pre-signed tranches are no longer eligible to
   * submit, mirroring the validity window baked into each inner
   * transaction's own time bounds at signing time.
   */
  expiresAt: number;
  tranches: DelegationTrancheRecord[];
  /** Tranche ids already submitted (successfully or not) — never resubmitted, whether or not this run recovers from a crash. */
  consumedTrancheIds: string[];
  /**
   * The guard config this grant authorizes automated unwinds under — a
   * grant with no guard config wouldn't have a reason to exist, since
   * granting delegation IS "turn on automated deleveraging for this
   * position". Deliberately kept on the grant rather than a separate store:
   * there is no other durable per-position record in this feature to hang
   * it off of, and the two are opened/revoked together in the UI.
   */
  guardConfig: { deleverageThreshold: number; hysteresis: number };
  /** The guard's own persisted breach flag (mirrors useRiskAlerts' BreachStateMap) — held through the hysteresis band between guard ticks. */
  breached: boolean;
}

export class DelegationScopeViolationError extends Error {
  constructor(
    public readonly positionId: string,
    public readonly reason: string
  ) {
    super(
      `Coordinator refused to submit a step outside its granted delegation for position ${positionId}: ${reason}`
    );
    this.name = "DelegationScopeViolationError";
  }
}

// ─── Coordinator runs (durable job ledger) ───────────────────────────────────

export type CoordinatorStepStatus =
  | "pending"
  | "submitting"
  | "confirming"
  | "completed"
  | "failed";

export interface CoordinatorStepRecord {
  /** Deterministic `${runId}:${trancheId}:${stepId}` — the same step is never submitted twice even across a crash-resume. */
  idempotencyKey: string;
  trancheId: string;
  stepId: string;
  status: CoordinatorStepStatus;
  txHash?: string;
  submittedAt?: number;
  confirmedAt?: number;
  errorMessage?: string;
}

export type CoordinatorRunStatus =
  | "in_progress"
  | "completed"
  | "failed"
  | "stopped";

export interface CoordinatorRun {
  id: string;
  positionId: string;
  grantId: string;
  reason: "deleverage-guard";
  triggeredAt: number;
  updatedAt: number;
  completedAt?: number;
  status: CoordinatorRunStatus;
  healthFactorAtTrigger: number | null;
  /** HF + hysteresis the guard is trying to clear — recorded so a resumed run knows its own stop condition without re-deriving it. */
  healthFactorTarget: number;
  trancheIdsPlanned: string[];
  steps: CoordinatorStepRecord[];
}
