import {
  JobsBackend,
  JobRunConflictError,
  SupabaseJobsBackend,
} from "./backend";
import { LeaseNotAcquiredError } from "./errors";
import type {
  ActionLogEntryRow,
  ActionLogLevel,
  JobRun,
  JobStatus,
  JobStep,
  JobType,
  StartOrResumeJobInput,
} from "./types";

const DEFAULT_LEASE_MS = 2 * 60_000;

/**
 * Business logic over a `JobsBackend`. Every mutating operation here is
 * either a single conditional row update (atomic at the storage layer) or
 * composed from a small number of them — the store itself holds no
 * in-process locks, so its safety under concurrent callers comes entirely
 * from the backend's conditional-update semantics.
 */
export class JobStore {
  constructor(private backend: JobsBackend) {}

  async startOrResumeJob(input: StartOrResumeJobInput): Promise<JobRun> {
    const existing = await this.backend.findJobRun(
      input.jobType,
      input.externalRef
    );

    if (existing) {
      const isTerminal =
        existing.status === "completed" ||
        existing.status === "failed" ||
        existing.status === "cancelled";
      if (input.resetIfTerminal && isTerminal) {
        await this.backend.resetSteps(existing.id, input.steps);
        return this.backend.resetJobRun(existing.id, input.payload ?? {});
      }
      return existing;
    }

    try {
      const job = await this.backend.insertJobRun({
        jobType: input.jobType,
        externalRef: input.externalRef,
        walletAddress: input.walletAddress ?? null,
        payload: input.payload ?? {},
      });
      await this.backend.insertSteps(job.id, input.steps);
      return job;
    } catch (err) {
      if (err instanceof JobRunConflictError) {
        const raced = await this.backend.findJobRun(
          input.jobType,
          input.externalRef
        );
        if (raced) return raced;
      }
      throw err;
    }
  }

  async getJobRun(id: string): Promise<JobRun | null> {
    return this.backend.getJobRun(id);
  }

  async findJobRun(
    jobType: JobType,
    externalRef: string
  ): Promise<JobRun | null> {
    return this.backend.findJobRun(jobType, externalRef);
  }

  async listJobRuns(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<JobRun[]> {
    return this.backend.listJobRuns(jobType, walletAddress);
  }

  async listSteps(jobId: string): Promise<JobStep[]> {
    return this.backend.listSteps(jobId);
  }

  async acquireLease(
    jobId: string,
    owner: string,
    leaseMs = DEFAULT_LEASE_MS
  ): Promise<JobRun> {
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresIso = new Date(now.getTime() + leaseMs).toISOString();
    const acquired = await this.backend.acquireLease(
      jobId,
      owner,
      nowIso,
      expiresIso
    );
    if (!acquired) {
      const current = await this.backend.getJobRun(jobId);
      throw new LeaseNotAcquiredError(
        current?.jobType ?? "unknown",
        current?.externalRef ?? jobId
      );
    }
    return acquired;
  }

  async releaseLease(jobId: string, owner: string): Promise<void> {
    await this.backend.releaseLease(jobId, owner);
  }

  async setStatus(
    jobId: string,
    status: JobStatus,
    error: string | null = null
  ): Promise<void> {
    await this.backend.setJobStatus(jobId, status, error);
  }

  async claimStep(
    jobId: string,
    index: number
  ): Promise<{ step: JobStep; claimed: boolean }> {
    const nowIso = new Date().toISOString();
    const claimed = await this.backend.claimStep(jobId, index, nowIso);
    if (claimed) return { step: claimed, claimed: true };

    const steps = await this.backend.listSteps(jobId);
    const current = steps.find((s) => s.index === index);
    if (!current) {
      throw new Error(`No step at index ${index} for job ${jobId}`);
    }
    return { step: current, claimed: false };
  }

  async completeStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>
  ): Promise<JobStep> {
    return this.backend.completeStep(
      jobId,
      index,
      result,
      new Date().toISOString()
    );
  }

  async failStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>
  ): Promise<JobStep> {
    return this.backend.failStep(
      jobId,
      index,
      result,
      new Date().toISOString()
    );
  }

  async skipStepsAfter(jobId: string, index: number): Promise<void> {
    await this.backend.skipStepsAfter(jobId, index);
  }

  async reclaimRunningSteps(jobId: string): Promise<void> {
    await this.backend.reclaimRunningSteps(jobId);
  }

  async appendActionLog(entry: {
    jobId?: string | null;
    jobType: JobType;
    walletAddress?: string | null;
    level?: ActionLogLevel;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<ActionLogEntryRow> {
    return this.backend.appendActionLog({
      jobId: entry.jobId ?? null,
      jobType: entry.jobType,
      walletAddress: entry.walletAddress ?? null,
      level: entry.level ?? "info",
      message: entry.message,
      metadata: entry.metadata ?? {},
    });
  }

  async listActionLog(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<ActionLogEntryRow[]> {
    return this.backend.listActionLog(jobType, walletAddress);
  }
}

export const jobStore = new JobStore(new SupabaseJobsBackend());
