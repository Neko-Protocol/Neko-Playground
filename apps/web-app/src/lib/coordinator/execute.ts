import { nanoid } from "nanoid";
import type { CoordinatorLedgerStore } from "./ledger";
import { DelegationScopeViolationError } from "./types";
import type { TrancheSelection } from "./delegation";
import type {
  CoordinatorRun,
  CoordinatorStepRecord,
  DelegationGrant,
} from "./types";

/**
 * Uniform submit+confirm transport, keyed by a step's submissionMode —
 * mirrors lib/strategy/execution.ts's TransportAdapter/SignFn split so this
 * module never imports the Stellar SDK directly and stays unit-testable
 * without a network, exactly like the wallet-present engine it complements.
 */
export interface CoordinatorTransportAdapter {
  submit(xdr: string, networkPassphrase: string): Promise<{ hash: string }>;
  confirm(hash: string): Promise<unknown>;
}

export interface CoordinatorExecutionDeps {
  store: CoordinatorLedgerStore;
  transports: Record<"rpc" | "soroswapApi", CoordinatorTransportAdapter>;
  /**
   * Wraps an already wallet-signed inner tx XDR with a fresh fee-bump
   * (server keypair, mirroring VAULT_MANAGER_SECRET_KEY's role) before
   * submission — the inner transaction's own fee may be stale by the time a
   * pre-signed tranche is actually used, months after it was granted.
   * Injected rather than built here so this module stays SDK-free; omit to
   * submit the inner XDR unmodified (e.g. in tests).
   */
  wrapForSubmission?: (
    signedInnerXdr: string,
    networkPassphrase: string
  ) => Promise<{ xdr: string }>;
}

export interface RunCoordinatorUnwindParams {
  grant: DelegationGrant;
  selection: TrancheSelection;
  healthFactorAtTrigger: number | null;
  healthFactorTarget: number;
  /** An existing in-progress run to resume (already reconciled — see reconcileCoordinatorRun), or omit to start a new one. */
  existingRun?: CoordinatorRun;
}

function idempotencyKey(
  runId: string,
  trancheId: string,
  stepId: string
): string {
  return `${runId}:${trancheId}:${stepId}`;
}

/**
 * Asserts every tranche this run is about to touch is a real member of the
 * exact grant it claims to run under. This is deliberately redundant with
 * the structural guarantee that only tranches inside a DelegationGrant are
 * ever submittable at all (there is no other source of signed XDRs this
 * module can reach) — a hard runtime check that fails loudly instead of
 * silently trusting the caller.
 *
 * The "already consumed" check is skipped when `isResume` is true: a
 * resumed run's own EARLIER tranches are expected to already be marked
 * consumed by that same run's prior progress (a tranche is marked consumed
 * the moment all its steps complete, which can happen on an earlier guard
 * tick before a crash) — rejecting that would make resumption impossible.
 * A tranche consumed by a genuinely DIFFERENT, unrelated run can still
 * never appear in a fresh selection in the first place, since
 * selectTranchesToClearBreach always filters consumedTrancheIds first.
 */
function assertWithinDelegation(
  grant: DelegationGrant,
  selection: TrancheSelection,
  isResume: boolean
): void {
  for (const trancheId of selection.trancheIds) {
    const tranche = grant.tranches.find((t) => t.id === trancheId);
    if (!tranche) {
      throw new DelegationScopeViolationError(
        grant.positionId,
        `tranche ${trancheId} is not part of this grant`
      );
    }
    if (!isResume && grant.consumedTrancheIds.includes(trancheId)) {
      throw new DelegationScopeViolationError(
        grant.positionId,
        `tranche ${trancheId} was already consumed by a prior run`
      );
    }
  }
}

/**
 * Submits a pre-approved partial unwind through the coordinator, resuming
 * an in-progress run at its next incomplete step rather than restarting
 * from scratch. Every step is persisted (pending -> submitting -> confirming
 * -> completed/failed) BEFORE and AFTER each network call, so a crash at
 * any point leaves the ledger able to say exactly where it stopped.
 *
 * Skips steps already "completed" or "failed" on resume — "failed" is a
 * definitive on-chain/network outcome (not a crash artifact) and is left
 * for the next guard tick or manual review to react to, not silently
 * retried. A step left "submitting"/"confirming" by a crash must be
 * reconciled against chain state FIRST (see reconcileCoordinatorRun) before
 * being passed back in as `existingRun` — this function treats any
 * non-completed/non-failed step as safe to (re)submit.
 */
export async function runCoordinatorUnwind(
  deps: CoordinatorExecutionDeps,
  params: RunCoordinatorUnwindParams
): Promise<CoordinatorRun> {
  const { grant, selection } = params;
  assertWithinDelegation(grant, selection, params.existingRun != null);

  let run = params.existingRun;
  if (run) {
    if (run.grantId !== grant.id || run.positionId !== grant.positionId) {
      throw new DelegationScopeViolationError(
        grant.positionId,
        "resumed run belongs to a different grant/position"
      );
    }
  } else {
    const runId = nanoid();
    const steps: CoordinatorStepRecord[] = selection.trancheIds.flatMap(
      (trancheId) => {
        const tranche = grant.tranches.find((t) => t.id === trancheId);
        if (!tranche) return [];
        return tranche.steps.map((s) => ({
          idempotencyKey: idempotencyKey(runId, trancheId, s.stepId),
          trancheId,
          stepId: s.stepId,
          status: "pending" as const,
        }));
      }
    );
    run = {
      id: runId,
      positionId: grant.positionId,
      grantId: grant.id,
      reason: "deleverage-guard",
      triggeredAt: Date.now(),
      updatedAt: Date.now(),
      status: "in_progress",
      healthFactorAtTrigger: params.healthFactorAtTrigger,
      healthFactorTarget: params.healthFactorTarget,
      trancheIdsPlanned: selection.trancheIds,
      steps,
    };
    await deps.store.saveRun(run);
  }

  const workingGrant: DelegationGrant = {
    ...grant,
    consumedTrancheIds: [...grant.consumedTrancheIds],
  };

  for (const stepRecord of run.steps) {
    if (stepRecord.status === "completed" || stepRecord.status === "failed")
      continue;

    const tranche = grant.tranches.find((t) => t.id === stepRecord.trancheId);
    const signedStep = tranche?.steps.find(
      (s) => s.stepId === stepRecord.stepId
    );
    if (!tranche || !signedStep) {
      throw new DelegationScopeViolationError(
        grant.positionId,
        `run step ${stepRecord.idempotencyKey} references a step no longer present in the grant`
      );
    }

    try {
      stepRecord.status = "submitting";
      run.updatedAt = Date.now();
      await deps.store.saveRun(run);

      const xdrToSubmit = deps.wrapForSubmission
        ? (
            await deps.wrapForSubmission(
              signedStep.signedXdr,
              signedStep.networkPassphrase
            )
          ).xdr
        : signedStep.signedXdr;

      const transport = deps.transports[signedStep.submissionMode];
      const { hash } = await transport.submit(
        xdrToSubmit,
        signedStep.networkPassphrase
      );
      stepRecord.txHash = hash;
      stepRecord.submittedAt = Date.now();
      stepRecord.status = "confirming";
      run.updatedAt = Date.now();
      await deps.store.saveRun(run);

      await transport.confirm(hash);
      stepRecord.status = "completed";
      stepRecord.confirmedAt = Date.now();
      run.updatedAt = Date.now();
      await deps.store.saveRun(run);
    } catch (error) {
      stepRecord.status = "failed";
      stepRecord.errorMessage =
        error instanceof Error ? error.message : String(error);
      run.status = "failed";
      run.updatedAt = Date.now();
      await deps.store.saveRun(run);
      return run;
    }

    const trancheFullyComplete = tranche.steps.every(
      (s) =>
        run!.steps.find(
          (r) => r.trancheId === tranche.id && r.stepId === s.stepId
        )?.status === "completed"
    );
    if (
      trancheFullyComplete &&
      !workingGrant.consumedTrancheIds.includes(tranche.id)
    ) {
      workingGrant.consumedTrancheIds.push(tranche.id);
      await deps.store.saveGrant(workingGrant);
    }
  }

  run.status = "completed";
  run.completedAt = Date.now();
  run.updatedAt = Date.now();
  await deps.store.saveRun(run);
  return run;
}

// ─── Crash recovery ──────────────────────────────────────────────────────────

export type OnChainTxStatus = "SUCCESS" | "FAILED" | "PENDING" | "NOT_FOUND";

export interface ReconcileCoordinatorRunDeps {
  getTransactionStatus: (hash: string) => Promise<OnChainTxStatus>;
}

/**
 * On restart: for any run step still marked "submitting"/"confirming" (the
 * process died between submit and the confirm-write), re-poll the chain to
 * determine the real outcome before runCoordinatorUnwind is asked to
 * resume — mirrors lib/strategy/execution.ts's reconcileExecution exactly,
 * for the exact same reason: resubmitting a step that actually already
 * landed on-chain would either double-execute it or blow up on a stale
 * sequence number. A PENDING/NOT_FOUND result is left untouched so a later
 * resume attempt can retry rather than guessing.
 */
export async function reconcileCoordinatorRun(
  run: CoordinatorRun,
  deps: ReconcileCoordinatorRunDeps
): Promise<CoordinatorRun> {
  const reconciled: CoordinatorRun = {
    ...run,
    steps: run.steps.map((s) => ({ ...s })),
  };

  for (const step of reconciled.steps) {
    const inFlight =
      step.status === "submitting" || step.status === "confirming";
    if (!inFlight || !step.txHash) continue;

    try {
      const status = await deps.getTransactionStatus(step.txHash);
      if (status === "SUCCESS") {
        step.status = "completed";
        step.confirmedAt = Date.now();
      } else if (status === "FAILED") {
        step.status = "failed";
        step.errorMessage =
          "Transaction failed on-chain while the coordinator was not running.";
      }
    } catch {
      // Reconciliation network error — leave the step's recorded status as-is; retried on a future resume.
    }
  }

  return reconciled;
}
