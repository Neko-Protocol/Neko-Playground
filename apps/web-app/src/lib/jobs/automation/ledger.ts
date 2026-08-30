import { jobStore } from "@/lib/jobs/store";
import { runJob } from "@/lib/jobs/runner";
import { JobNotFoundError, JobOwnershipError } from "@/lib/jobs/errors";
import type {
  ActionLogEntryRow,
  JobRun,
  JobStep,
  JobStepStatus,
  StepDefinition,
} from "@/lib/jobs/types";
import type {
  ActionLogEntry,
  ExecutionStep,
  RebalancePlan,
  StepStatus,
} from "@/features/automation/types/automation";
import { automationStepExecutors } from "./stepExecutors";

const JOB_TYPE = "automation-rebalance" as const;

interface AutomationJobPayload {
  strategyId: string;
  strategyName: string;
  triggerReason: string;
  currentBlendedNetApyBps: number;
  proposedBlendedNetApyBps: number;
  improvementBps: number;
  estimatedSlippageBps: number;
  estimatedFeeUsd: number;
  estimatedGasUsd: number;
  projectedEarningsDeltaUsd: { d30: number; d90: number; d365: number };
  targets: RebalancePlan["targets"];
}

function jobStatusToPlanStatus(job: JobRun): RebalancePlan["status"] {
  switch (job.status) {
    case "pending":
      return "confirmed";
    case "running":
      return "executing";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "aborted";
  }
}

function stepStatusToExecutionStepStatus(status: JobStepStatus): StepStatus {
  switch (status) {
    case "pending":
      return "pending";
    case "running":
      return "submitted";
    case "completed":
      return "confirmed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
  }
}

function toExecutionStep(step: JobStep): ExecutionStep {
  const error =
    step.status === "failed"
      ? String(
          (step.result as { error?: unknown } | null)?.error ?? "Step failed"
        )
      : undefined;
  return {
    id: step.id,
    planId: step.jobId,
    index: step.index,
    kind: step.kind as ExecutionStep["kind"],
    venueId: String(step.input.venueId ?? ""),
    asset: String(step.input.asset ?? ""),
    amountUsd: Number(step.input.amountUsd ?? 0),
    status: stepStatusToExecutionStepStatus(step.status),
    error,
    retryCount: 0,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt,
  };
}

function toRebalancePlan(job: JobRun, steps: JobStep[]): RebalancePlan {
  const payload = job.payload as unknown as AutomationJobPayload;
  return {
    id: job.externalRef,
    strategyId: payload.strategyId,
    createdAt: job.createdAt,
    triggerReason: payload.triggerReason,
    currentBlendedNetApyBps: payload.currentBlendedNetApyBps,
    proposedBlendedNetApyBps: payload.proposedBlendedNetApyBps,
    improvementBps: payload.improvementBps,
    estimatedSlippageBps: payload.estimatedSlippageBps,
    estimatedFeeUsd: payload.estimatedFeeUsd,
    estimatedGasUsd: payload.estimatedGasUsd,
    projectedEarningsDeltaUsd: payload.projectedEarningsDeltaUsd,
    targets: payload.targets,
    steps: [...steps].sort((a, b) => a.index - b.index).map(toExecutionStep),
    status: jobStatusToPlanStatus(job),
  };
}

async function appendOutcomeLog(job: JobRun, steps: JobStep[]): Promise<void> {
  if (
    job.status !== "completed" &&
    job.status !== "failed" &&
    job.status !== "cancelled"
  ) {
    return;
  }
  const payload = job.payload as unknown as AutomationJobPayload;
  const txHashes = steps.flatMap((s) =>
    typeof (s.result as { hash?: unknown } | null)?.hash === "string"
      ? [(s.result as { hash: string }).hash]
      : []
  );
  const outcome: ActionLogEntry["outcome"] =
    job.status === "completed"
      ? "executed"
      : job.status === "cancelled"
        ? "aborted"
        : "failed";

  await jobStore.appendActionLog({
    jobId: job.id,
    jobType: JOB_TYPE,
    walletAddress: job.walletAddress,
    level: job.status === "failed" ? "error" : "info",
    message: `Plan ${job.externalRef} ${outcome}`,
    metadata: {
      entryKind: "outcome",
      strategyId: payload.strategyId,
      strategyName: payload.strategyName,
      planId: job.externalRef,
      triggerReason: payload.triggerReason,
      candidatesConsidered: payload.targets?.length ?? 0,
      proposedNetApyBps: payload.proposedBlendedNetApyBps,
      estimatedSlippageBps: payload.estimatedSlippageBps,
      estimatedFeeUsd: payload.estimatedFeeUsd,
      txHashes,
      outcome,
      notes: job.error ?? undefined,
    },
  });
}

export async function confirmPlan(
  plan: RebalancePlan,
  walletAddress: string,
  strategyName: string
): Promise<RebalancePlan> {
  const steps: StepDefinition[] = plan.steps.map((step) => ({
    kind: step.kind,
    input: {
      venueId: step.venueId,
      asset: step.asset,
      amountUsd: step.amountUsd,
    },
  }));

  const job = await jobStore.startOrResumeJob({
    jobType: JOB_TYPE,
    externalRef: plan.id,
    walletAddress,
    payload: {
      strategyId: plan.strategyId,
      strategyName,
      triggerReason: plan.triggerReason,
      currentBlendedNetApyBps: plan.currentBlendedNetApyBps,
      proposedBlendedNetApyBps: plan.proposedBlendedNetApyBps,
      improvementBps: plan.improvementBps,
      estimatedSlippageBps: plan.estimatedSlippageBps,
      estimatedFeeUsd: plan.estimatedFeeUsd,
      estimatedGasUsd: plan.estimatedGasUsd,
      projectedEarningsDeltaUsd: plan.projectedEarningsDeltaUsd,
      targets: plan.targets,
    } satisfies AutomationJobPayload,
    steps,
  });

  if (job.walletAddress !== walletAddress) {
    throw new JobOwnershipError();
  }

  const { job: finalJob, steps: finalSteps } = await runJob(jobStore, {
    jobId: job.id,
    workerId: `automation:${job.id}:${Date.now()}`,
    executors: automationStepExecutors,
  });

  await appendOutcomeLog(finalJob, finalSteps);
  return toRebalancePlan(finalJob, finalSteps);
}

export async function cancelPlan(
  planId: string,
  walletAddress: string
): Promise<RebalancePlan> {
  const job = await jobStore.findJobRun(JOB_TYPE, planId);
  if (!job) throw new JobNotFoundError(`${JOB_TYPE}:${planId}`);
  if (job.walletAddress !== walletAddress) {
    throw new JobOwnershipError();
  }

  // A failed run is still cancellable — that's the documented recovery path
  // for dismissing it out of the active queue. Only an already
  // completed/cancelled run is a genuine no-op.
  const alreadyResolved =
    job.status === "completed" || job.status === "cancelled";
  if (!alreadyResolved) {
    await jobStore.setStatus(job.id, "cancelled");
    await jobStore.skipStepsAfter(job.id, -1);
  }

  const [finalJob, finalSteps] = await Promise.all([
    jobStore.getJobRun(job.id),
    jobStore.listSteps(job.id),
  ]);
  if (!alreadyResolved) await appendOutcomeLog(finalJob!, finalSteps);
  return toRebalancePlan(finalJob!, finalSteps);
}

export async function listPlansForWallet(
  strategyId: string | null,
  walletAddress: string
): Promise<RebalancePlan[]> {
  const jobs = await jobStore.listJobRuns(JOB_TYPE, walletAddress);
  const filtered = strategyId
    ? jobs.filter(
        (job) =>
          (job.payload as unknown as AutomationJobPayload).strategyId ===
          strategyId
      )
    : jobs;

  return Promise.all(
    filtered.map(async (job) => {
      const steps = await jobStore.listSteps(job.id);
      return toRebalancePlan(job, steps);
    })
  );
}

function rowToActionLogEntry(row: ActionLogEntryRow): ActionLogEntry {
  const m = row.metadata as Record<string, unknown>;
  return {
    id: row.id,
    strategyId: String(m.strategyId ?? ""),
    strategyName: String(m.strategyName ?? ""),
    planId: typeof m.planId === "string" ? m.planId : undefined,
    timestamp: row.occurredAt,
    triggerReason: String(m.triggerReason ?? ""),
    candidatesConsidered: Number(m.candidatesConsidered ?? 0),
    proposedNetApyBps: Number(m.proposedNetApyBps ?? 0),
    estimatedSlippageBps: Number(m.estimatedSlippageBps ?? 0),
    estimatedFeeUsd: Number(m.estimatedFeeUsd ?? 0),
    txHashes: Array.isArray(m.txHashes) ? (m.txHashes as string[]) : [],
    outcome: (m.outcome as ActionLogEntry["outcome"]) ?? "executed",
    notes: typeof m.notes === "string" ? m.notes : undefined,
  };
}

export async function listHistoryForWallet(
  walletAddress: string
): Promise<ActionLogEntry[]> {
  const rows = await jobStore.listActionLog(JOB_TYPE, walletAddress);
  return rows
    .filter((row) => row.metadata.entryKind === "outcome")
    .map(rowToActionLogEntry)
    .reverse();
}
