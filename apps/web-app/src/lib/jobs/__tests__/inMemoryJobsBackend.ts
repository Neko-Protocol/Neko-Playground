import { randomUUID } from "node:crypto";
import type { JobsBackend } from "../backend";
import { JobRunConflictError } from "../backend";
import type {
  ActionLogEntryRow,
  ActionLogLevel,
  JobRun,
  JobStatus,
  JobStep,
  JobStepStatus,
  JobType,
  StepDefinition,
} from "../types";

/**
 * In-process fake standing in for Postgres row locking: every conditional
 * mutation below is written as synchronous check-then-write with no
 * `await` in between, so Node's run-to-completion semantics give the same
 * "first writer wins" guarantee a real `UPDATE ... WHERE` gets from the
 * database — which is exactly the property the concurrency tests exercise.
 */
export class InMemoryJobsBackend implements JobsBackend {
  private jobs = new Map<string, JobRun>();
  private steps = new Map<string, JobStep[]>();
  private actionLog: ActionLogEntryRow[] = [];

  async findJobRun(
    jobType: JobType,
    externalRef: string
  ): Promise<JobRun | null> {
    for (const job of this.jobs.values()) {
      if (job.jobType === jobType && job.externalRef === externalRef) {
        return { ...job };
      }
    }
    return null;
  }

  async getJobRun(id: string): Promise<JobRun | null> {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  async listJobRuns(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<JobRun[]> {
    return [...this.jobs.values()]
      .filter(
        (j) =>
          j.jobType === jobType &&
          (!walletAddress || j.walletAddress === walletAddress)
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((j) => ({ ...j }));
  }

  async insertJobRun(row: {
    jobType: JobType;
    externalRef: string;
    walletAddress: string | null;
    payload: Record<string, unknown>;
  }): Promise<JobRun> {
    const existing = await this.findJobRun(row.jobType, row.externalRef);
    if (existing) throw new JobRunConflictError();
    const now = Date.now();
    const job: JobRun = {
      id: randomUUID(),
      jobType: row.jobType,
      externalRef: row.externalRef,
      walletAddress: row.walletAddress,
      status: "pending",
      payload: row.payload,
      leaseOwner: null,
      leaseExpiresAt: null,
      error: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    this.steps.set(job.id, []);
    return { ...job };
  }

  async resetJobRun(
    id: string,
    payload: Record<string, unknown>
  ): Promise<JobRun> {
    const job = this.mustGet(id);
    job.status = "pending";
    job.payload = payload;
    job.error = null;
    job.leaseOwner = null;
    job.leaseExpiresAt = null;
    job.updatedAt = Date.now();
    return { ...job };
  }

  async insertSteps(jobId: string, steps: StepDefinition[]): Promise<void> {
    const existing = this.steps.get(jobId) ?? [];
    if (existing.length > 0) return;
    const now = Date.now();
    this.steps.set(
      jobId,
      steps.map((step, index) => ({
        id: randomUUID(),
        jobId,
        index,
        kind: step.kind,
        input: step.input ?? {},
        status: "pending" as JobStepStatus,
        result: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  async resetSteps(jobId: string, steps: StepDefinition[]): Promise<void> {
    this.steps.set(jobId, []);
    await this.insertSteps(jobId, steps);
  }

  async listSteps(jobId: string): Promise<JobStep[]> {
    return (this.steps.get(jobId) ?? []).map((s) => ({ ...s }));
  }

  async acquireLease(
    jobId: string,
    owner: string,
    nowIso: string,
    expiresIso: string
  ): Promise<JobRun | null> {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    const now = new Date(nowIso).getTime();
    const leaseFree = !job.leaseOwner || (job.leaseExpiresAt ?? 0) < now;
    const terminal = job.status === "completed" || job.status === "cancelled";
    if (!leaseFree || terminal) return null;
    job.leaseOwner = owner;
    job.leaseExpiresAt = new Date(expiresIso).getTime();
    job.updatedAt = now;
    return { ...job };
  }

  async releaseLease(jobId: string, owner: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job && job.leaseOwner === owner) {
      job.leaseOwner = null;
      job.leaseExpiresAt = null;
    }
  }

  async setJobStatus(
    jobId: string,
    status: JobStatus,
    error: string | null
  ): Promise<void> {
    const job = this.mustGet(jobId);
    job.status = status;
    job.error = error;
    job.updatedAt = Date.now();
  }

  async claimStep(
    jobId: string,
    index: number,
    nowIso: string
  ): Promise<JobStep | null> {
    const step = this.findStep(jobId, index);
    if (!step || step.status !== "pending") return null;
    step.status = "running";
    step.startedAt = new Date(nowIso).getTime();
    step.updatedAt = step.startedAt;
    return { ...step };
  }

  async completeStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>,
    nowIso: string
  ): Promise<JobStep> {
    const step = this.mustFindStep(jobId, index);
    step.status = "completed";
    step.result = result;
    step.completedAt = new Date(nowIso).getTime();
    step.updatedAt = step.completedAt;
    return { ...step };
  }

  async failStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>,
    nowIso: string
  ): Promise<JobStep> {
    const step = this.mustFindStep(jobId, index);
    step.status = "failed";
    step.result = result;
    step.completedAt = new Date(nowIso).getTime();
    step.updatedAt = step.completedAt;
    return { ...step };
  }

  async skipStepsAfter(jobId: string, index: number): Promise<void> {
    for (const step of this.steps.get(jobId) ?? []) {
      if (step.index > index && step.status === "pending") {
        step.status = "skipped";
        step.updatedAt = Date.now();
      }
    }
  }

  async reclaimRunningSteps(jobId: string): Promise<void> {
    for (const step of this.steps.get(jobId) ?? []) {
      if (step.status === "running") {
        step.status = "pending";
        step.startedAt = null;
        step.updatedAt = Date.now();
      }
    }
  }

  async appendActionLog(entry: {
    jobId: string | null;
    jobType: JobType;
    walletAddress: string | null;
    level: ActionLogLevel;
    message: string;
    metadata: Record<string, unknown>;
  }): Promise<ActionLogEntryRow> {
    const row: ActionLogEntryRow = {
      id: randomUUID(),
      ...entry,
      occurredAt: Date.now() + this.actionLog.length,
    };
    this.actionLog.push(row);
    return { ...row };
  }

  async listActionLog(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<ActionLogEntryRow[]> {
    return this.actionLog
      .filter(
        (e) =>
          e.jobType === jobType &&
          (!walletAddress || e.walletAddress === walletAddress)
      )
      .sort((a, b) => a.occurredAt - b.occurredAt)
      .map((e) => ({ ...e }));
  }

  private mustGet(id: string): JobRun {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`No job run ${id}`);
    return job;
  }

  private findStep(jobId: string, index: number): JobStep | undefined {
    return (this.steps.get(jobId) ?? []).find((s) => s.index === index);
  }

  private mustFindStep(jobId: string, index: number): JobStep {
    const step = this.findStep(jobId, index);
    if (!step) throw new Error(`No step ${index} for job ${jobId}`);
    return step;
  }
}
