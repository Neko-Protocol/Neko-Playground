export type JobType = "automation-rebalance" | "vault-invest";

export type JobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type JobStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type ActionLogLevel = "info" | "warn" | "error";

export interface JobRun {
  id: string;
  jobType: JobType;
  externalRef: string;
  walletAddress: string | null;
  status: JobStatus;
  payload: Record<string, unknown>;
  leaseOwner: string | null;
  leaseExpiresAt: number | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface JobStep {
  id: string;
  jobId: string;
  index: number;
  kind: string;
  input: Record<string, unknown>;
  status: JobStepStatus;
  result: Record<string, unknown> | null;
  startedAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ActionLogEntryRow {
  id: string;
  jobId: string | null;
  jobType: JobType;
  walletAddress: string | null;
  level: ActionLogLevel;
  message: string;
  metadata: Record<string, unknown>;
  occurredAt: number;
}

export interface StepDefinition {
  kind: string;
  input?: Record<string, unknown>;
}

export interface StartOrResumeJobInput {
  jobType: JobType;
  externalRef: string;
  walletAddress?: string | null;
  payload?: Record<string, unknown>;
  steps: StepDefinition[];
  /**
   * Vault's invest cycle reuses a single row forever — a run that reached
   * any terminal state (completed, failed, or cancelled) is reset in place
   * for the next cycle, so a transient failure doesn't permanently stall an
   * unattended cron. Automation plans are one row per plan id and rely on
   * the explicit `cancel` action for recovery, so a terminal run there is
   * just returned as-is (idempotent re-confirm).
   */
  resetIfTerminal?: boolean;
}

export interface StepExecutionContext {
  job: JobRun;
  step: JobStep;
}

export type StepExecutor = (
  ctx: StepExecutionContext
) => Promise<Record<string, unknown>>;

export interface RunJobResult {
  job: JobRun;
  steps: JobStep[];
}
