import { topologicalSort, deviationThresholdFor } from "./engine";
import { findUnfinishedExecutions } from "./persistence";
import { strategyStepRegistry, type StrategyStepRegistry } from "./registry";
import type {
  DeviationReport,
  ExecutionRecord,
  ExecutionStatus,
  ExecutionStepRecord,
  ParamBinding,
  StepExecutionContext,
  StepProjection,
  Strategy,
  StrategyStep,
  StrategyProjection,
} from "./types";

// ─── Deviation check ─────────────────────────────────────────────────────────

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  )
    return Number(value);
  return null;
}

/**
 * Compares a step's actual on-chain outputs against its simulated
 * projection. Finds the first output port with a numeric value on both
 * sides and computes relative deviation from it. When nothing comparable
 * exists, deviation can't be measured and the step is treated as
 * non-deviated.
 */
export function checkDeviation(
  stepType: string,
  projected: StepProjection,
  actualOutputs: Record<string, unknown>
): DeviationReport {
  const threshold = deviationThresholdFor(stepType);

  for (const [portId, projectedValue] of Object.entries(projected.outputs)) {
    const projectedNum = toNumber(projectedValue);
    const actualNum = toNumber(actualOutputs[portId]);
    if (projectedNum == null || actualNum == null || projectedNum === 0)
      continue;

    const relativeDeviation =
      Math.abs(actualNum - projectedNum) / Math.abs(projectedNum);
    const deviated = relativeDeviation > threshold;
    return {
      deviated,
      relativeDeviation,
      threshold,
      message: deviated
        ? `Actual output for "${portId}" (${actualNum}) deviates ${(relativeDeviation * 100).toFixed(1)}% from the projected ${projectedNum}, exceeding the ${(threshold * 100).toFixed(1)}% threshold.`
        : undefined,
    };
  }

  return { deviated: false, relativeDeviation: null, threshold };
}

// ─── Execution engine ────────────────────────────────────────────────────────

export type SignFn = (
  xdr: string,
  options: { networkPassphrase: string; address?: string }
) => Promise<{ signedTxXdr: string }>;

/**
 * Uniform submit+confirm transport, keyed by a step definition's
 * submissionMode. Real wiring (rpc.Server + waitForTransaction for "rpc",
 * the SoroSwap send API for "soroswapApi") lives in the useStrategyExecution
 * hook — the engine itself never imports the Stellar SDK, which is what
 * makes it fully unit-testable without a network.
 */
export interface TransportAdapter {
  submit(
    signedXdr: string,
    networkPassphrase: string
  ): Promise<{ hash: string }>;
  confirm(hash: string): Promise<unknown>;
}

export interface ExecutionEngineDeps {
  registry?: StrategyStepRegistry;
  sign: SignFn;
  transports: Record<"rpc" | "soroswapApi", TransportAdapter>;
}

export interface ExecuteStrategyParams {
  strategy: Strategy;
  /** Existing (possibly partially-completed, for resume) or freshly-created record. */
  execution: ExecutionRecord;
  userAddress: string;
  networkPassphrase: string;
  /** Step ids whose recorded "paused_deviation" the user has explicitly acknowledged — resume accepts the already-executed result instead of re-submitting. */
  acknowledgedDeviationStepIds?: string[];
  /** Called after every step status transition — wire to persistence (upsertExecution) and UI progress. */
  onStepUpdate?: (record: ExecutionRecord) => void;
}

export interface ExecuteStrategyResult {
  record: ExecutionRecord;
  status: ExecutionStatus;
}

function cloneRecord(record: ExecutionRecord): ExecutionRecord {
  return JSON.parse(JSON.stringify(record)) as ExecutionRecord;
}

function resolveExecBinding(
  binding: ParamBinding,
  upstreamOutputs: Record<string, Record<string, unknown>>
): unknown {
  if (binding.source === "literal") return binding.value;
  return upstreamOutputs[binding.stepId]?.[binding.portId];
}

function resolveExecParams(
  step: StrategyStep,
  upstreamOutputs: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, binding] of Object.entries(step.params))
    resolved[key] = resolveExecBinding(binding, upstreamOutputs);
  return resolved;
}

function updateStep(
  record: ExecutionRecord,
  stepId: string,
  patch: Partial<ExecutionStepRecord>
): ExecutionStepRecord {
  const idx = record.steps.findIndex((s) => s.stepId === stepId);
  if (idx === -1) {
    const created: ExecutionStepRecord = {
      stepId,
      status: "pending",
      ...patch,
    };
    record.steps.push(created);
    return created;
  }
  record.steps[idx] = { ...record.steps[idx], ...patch };
  record.updatedAt = Date.now();
  return record.steps[idx];
}

/**
 * Executes a strategy step-by-step: prepare -> sign -> submit -> confirm ->
 * validate before continuing. Framework-agnostic (no React, no direct
 * Stellar SDK imports) so it's usable from a hook and testable in
 * isolation. Supports resuming a partially-completed ExecutionRecord —
 * already-"completed" steps are skipped and their actualOutputs seed
 * upstreamOutputs for the rest of the run; a "paused_deviation" step is
 * only advanced past once its id appears in acknowledgedDeviationStepIds,
 * and even then it is accepted (not re-submitted) to avoid a duplicate
 * on-chain transaction.
 */
export class ExecutionEngine {
  constructor(private readonly deps: ExecutionEngineDeps) {}

  async executeStrategy(
    params: ExecuteStrategyParams
  ): Promise<ExecuteStrategyResult> {
    const registry = this.deps.registry ?? strategyStepRegistry;
    const { order } = topologicalSort(params.strategy.steps);
    const record = cloneRecord(params.execution);

    if (!order) {
      record.status = "failed";
      params.onStepUpdate?.(record);
      return { record, status: "failed" };
    }

    const stepsById = new Map(params.strategy.steps.map((s) => [s.id, s]));
    const upstreamOutputs: Record<string, Record<string, unknown>> = {};
    for (const s of record.steps) {
      if (s.status === "completed" && s.actualOutputs)
        upstreamOutputs[s.stepId] = s.actualOutputs;
    }

    const acknowledged = new Set(params.acknowledgedDeviationStepIds ?? []);
    const baselineProjection = record.projectedOutcome as
      | StrategyProjection
      | undefined;

    for (const stepId of order) {
      const step = stepsById.get(stepId);
      if (!step) continue;

      const existing = record.steps.find((s) => s.stepId === stepId);
      if (existing?.status === "completed") continue;

      if (existing?.status === "paused_deviation") {
        if (!acknowledged.has(stepId)) {
          record.status = "paused-deviation";
          params.onStepUpdate?.(record);
          return { record, status: "paused-deviation" };
        }
        updateStep(record, stepId, { status: "completed" });
        if (existing.actualOutputs)
          upstreamOutputs[stepId] = existing.actualOutputs;
        continue;
      }

      const definition = registry.tryResolve(step.type, step.protocol);
      if (!definition) {
        updateStep(record, stepId, {
          status: "failed",
          errorMessage: `No step definition registered for ${step.type}:${step.protocol}`,
        });
        record.status = "failed";
        params.onStepUpdate?.(record);
        return { record, status: "failed" };
      }

      try {
        updateStep(record, stepId, { status: "preparing" });
        params.onStepUpdate?.(record);

        const ctx: StepExecutionContext = {
          userAddress: params.userAddress,
          networkPassphrase: params.networkPassphrase,
          resolvedParams: resolveExecParams(step, upstreamOutputs),
          upstreamOutputs,
        };

        const tx = await definition.prepare(ctx);

        updateStep(record, stepId, { status: "awaiting_signature" });
        params.onStepUpdate?.(record);
        const signed = await this.deps.sign(tx.xdr, {
          networkPassphrase: tx.networkPassphrase,
          address: params.userAddress,
        });

        updateStep(record, stepId, { status: "submitting" });
        params.onStepUpdate?.(record);
        const transport = this.deps.transports[definition.submissionMode];
        const { hash } = await transport.submit(
          signed.signedTxXdr,
          tx.networkPassphrase
        );
        updateStep(record, stepId, {
          status: "confirming",
          txHash: hash,
          submittedAt: Date.now(),
        });
        params.onStepUpdate?.(record);

        const confirmedResult = await transport.confirm(hash);
        const interpreted = definition.interpretResult
          ? await definition.interpretResult(ctx, confirmedResult)
          : {};
        const actualOutputs = interpreted.outputs ?? {};

        const stepProjection = baselineProjection?.steps?.[stepId];
        const deviation = stepProjection
          ? checkDeviation(step.type, stepProjection, actualOutputs)
          : {
              deviated: false,
              relativeDeviation: null,
              threshold: deviationThresholdFor(step.type),
            };

        if (deviation.deviated) {
          updateStep(record, stepId, {
            status: "paused_deviation",
            confirmedAt: Date.now(),
            actualOutputs,
            deviation,
          });
          record.status = "paused-deviation";
          params.onStepUpdate?.(record);
          return { record, status: "paused-deviation" };
        }

        updateStep(record, stepId, {
          status: "completed",
          confirmedAt: Date.now(),
          actualOutputs,
          deviation,
        });
        upstreamOutputs[stepId] = actualOutputs;
        record.status = "in_progress";
        params.onStepUpdate?.(record);
      } catch (error) {
        updateStep(record, stepId, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        record.status = "failed";
        params.onStepUpdate?.(record);
        return { record, status: "failed" };
      }
    }

    record.status = "completed";
    record.completedAt = Date.now();
    params.onStepUpdate?.(record);
    return { record, status: "completed" };
  }
}

// ─── Recovery ────────────────────────────────────────────────────────────────

export type OnChainTxStatus = "SUCCESS" | "FAILED" | "PENDING" | "NOT_FOUND";

export interface ReconcileDeps {
  getTransactionStatus: (hash: string) => Promise<OnChainTxStatus>;
}

/**
 * On reopen: for a record with a step still marked "submitting"/"confirming"
 * (the app closed between submit and the confirm-write), re-poll the chain
 * to determine the real outcome before the UI offers Resume — this is the
 * "reconcile completed steps" half of execution recovery. A PENDING/
 * NOT_FOUND result is left untouched (still genuinely in flight, or the
 * poll itself failed) so a later resume attempt can retry rather than
 * guessing.
 */
export async function reconcileExecution(
  execution: ExecutionRecord,
  deps: ReconcileDeps
): Promise<ExecutionRecord> {
  const record = cloneRecord(execution);

  for (const step of record.steps) {
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
          "Transaction failed on-chain while the app was closed.";
      }
    } catch {
      // Reconciliation network error — leave the step's recorded status as-is; retried on a future resume.
    }
  }

  return record;
}

/** Detects unfinished executions for the "resume or abandon" prompt on app reopen. */
export function findResumableExecutions(
  walletAddress: string
): ExecutionRecord[] {
  return findUnfinishedExecutions(walletAddress);
}
