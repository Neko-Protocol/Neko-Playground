import { JobStore } from "./store";
import type { JobRun, JobStep, RunJobResult, StepExecutor } from "./types";

export interface RunJobOptions {
  jobId: string;
  workerId: string;
  executors: Record<string, StepExecutor>;
  leaseMs?: number;
}

/**
 * Acquires the run's lease, then executes its steps in index order.
 *
 * Idempotency and crash-resumption both fall out of the same rule: a step
 * already `completed`/`skipped` is never re-executed, and `claimStep` is a
 * single conditional update, so two overlapping calls for the same job can
 * never both execute the same step. A step failure stops the run
 * immediately and marks every remaining pending step `skipped` — nothing is
 * left dangling in `pending` once the run reaches a terminal state.
 */
export async function runJob(
  store: JobStore,
  { jobId, workerId, executors, leaseMs }: RunJobOptions
): Promise<RunJobResult> {
  const job = await store.acquireLease(jobId, workerId, leaseMs);

  try {
    if (job.status === "pending") {
      await store.setStatus(jobId, "running");
    }

    // Acquiring the lease means any previous holder is gone. A step it left
    // mid-flight ("running", never completed/failed) is exactly a crash —
    // reclaim it back to "pending" so this pass retries it instead of
    // treating the run as permanently stuck.
    await store.reclaimRunningSteps(jobId);

    const orderedSteps = (await store.listSteps(jobId)).sort(
      (a, b) => a.index - b.index
    );

    for (const step of orderedSteps) {
      if (step.status === "completed" || step.status === "skipped") continue;
      if (step.status === "failed") {
        return finish(store, jobId, job);
      }

      const { step: claimed, claimed: didClaim } = await store.claimStep(
        jobId,
        step.index
      );

      if (!didClaim) {
        if (claimed.status === "failed") return finish(store, jobId, job);
        if (claimed.status === "completed" || claimed.status === "skipped") {
          continue;
        }
        // Another worker is actively running this step right now — stop
        // here rather than racing it.
        return finish(store, jobId, job);
      }

      const executor = executors[claimed.kind];
      try {
        const result = executor ? await executor({ job, step: claimed }) : {};
        await store.completeStep(jobId, claimed.index, result);
        await store.appendActionLog({
          jobId,
          jobType: job.jobType,
          walletAddress: job.walletAddress,
          level: "info",
          message: `Step ${claimed.index} (${claimed.kind}) completed`,
          metadata: result,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await store.failStep(jobId, claimed.index, { error: message });
        await store.skipStepsAfter(jobId, claimed.index);
        await store.setStatus(jobId, "failed", message);
        await store.appendActionLog({
          jobId,
          jobType: job.jobType,
          walletAddress: job.walletAddress,
          level: "error",
          message: `Step ${claimed.index} (${claimed.kind}) failed: ${message}`,
        });
        return finish(store, jobId, job);
      }
    }

    const finalSteps = await store.listSteps(jobId);
    const allResolved = finalSteps.every(
      (s) => s.status === "completed" || s.status === "skipped"
    );
    if (allResolved) {
      await store.setStatus(jobId, "completed");
    }
    return finish(store, jobId, job);
  } finally {
    await store.releaseLease(jobId, workerId);
  }
}

async function finish(
  store: JobStore,
  jobId: string,
  fallback: JobRun
): Promise<{ job: JobRun; steps: JobStep[] }> {
  const [job, steps] = await Promise.all([
    store.getJobRun(jobId),
    store.listSteps(jobId),
  ]);
  return { job: job ?? fallback, steps };
}
