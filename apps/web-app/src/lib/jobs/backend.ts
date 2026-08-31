import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env.server";
import type {
  ActionLogEntryRow,
  ActionLogLevel,
  JobRun,
  JobStatus,
  JobStep,
  JobStepStatus,
  JobType,
  StepDefinition,
} from "./types";

/**
 * Storage-level contract for the job ledger. Every method that mutates a
 * row conditionally (lease acquisition, step claiming) returns `null` when
 * the condition wasn't met instead of throwing — that's the idempotency /
 * concurrency-safety signal the store and runner rely on.
 */
export interface JobsBackend {
  findJobRun(jobType: JobType, externalRef: string): Promise<JobRun | null>;
  getJobRun(id: string): Promise<JobRun | null>;
  listJobRuns(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<JobRun[]>;
  insertJobRun(row: {
    jobType: JobType;
    externalRef: string;
    walletAddress: string | null;
    payload: Record<string, unknown>;
  }): Promise<JobRun>;
  resetJobRun(id: string, payload: Record<string, unknown>): Promise<JobRun>;

  insertSteps(jobId: string, steps: StepDefinition[]): Promise<void>;
  resetSteps(jobId: string, steps: StepDefinition[]): Promise<void>;
  listSteps(jobId: string): Promise<JobStep[]>;

  acquireLease(
    jobId: string,
    owner: string,
    nowIso: string,
    expiresIso: string
  ): Promise<JobRun | null>;
  releaseLease(jobId: string, owner: string): Promise<void>;
  setJobStatus(
    jobId: string,
    status: JobStatus,
    error: string | null
  ): Promise<void>;

  claimStep(
    jobId: string,
    index: number,
    nowIso: string
  ): Promise<JobStep | null>;
  completeStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>,
    nowIso: string
  ): Promise<JobStep>;
  failStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>,
    nowIso: string
  ): Promise<JobStep>;
  skipStepsAfter(jobId: string, index: number): Promise<void>;
  reclaimRunningSteps(jobId: string): Promise<void>;

  appendActionLog(entry: {
    jobId: string | null;
    jobType: JobType;
    walletAddress: string | null;
    level: ActionLogLevel;
    message: string;
    metadata: Record<string, unknown>;
  }): Promise<ActionLogEntryRow>;
  listActionLog(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<ActionLogEntryRow[]>;
}

// ─── Row <-> domain mapping ──────────────────────────────────────────────

interface JobRunRow {
  id: string;
  job_type: JobType;
  external_ref: string;
  wallet_address: string | null;
  status: JobStatus;
  payload: Record<string, unknown>;
  lease_owner: string | null;
  lease_expires_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

interface JobStepRow {
  id: string;
  job_id: string;
  step_index: number;
  kind: string;
  input: Record<string, unknown>;
  status: JobStepStatus;
  result: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ActionLogRow {
  id: string;
  job_id: string | null;
  job_type: JobType;
  wallet_address: string | null;
  level: ActionLogLevel;
  message: string;
  metadata: Record<string, unknown>;
  occurred_at: string;
}

function mapJobRun(row: JobRunRow): JobRun {
  return {
    id: row.id,
    jobType: row.job_type,
    externalRef: row.external_ref,
    walletAddress: row.wallet_address,
    status: row.status,
    payload: row.payload ?? {},
    leaseOwner: row.lease_owner,
    leaseExpiresAt: row.lease_expires_at
      ? new Date(row.lease_expires_at).getTime()
      : null,
    error: row.error,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapJobStep(row: JobStepRow): JobStep {
  return {
    id: row.id,
    jobId: row.job_id,
    index: row.step_index,
    kind: row.kind,
    input: row.input ?? {},
    status: row.status,
    result: row.result,
    startedAt: row.started_at ? new Date(row.started_at).getTime() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function mapActionLog(row: ActionLogRow): ActionLogEntryRow {
  return {
    id: row.id,
    jobId: row.job_id,
    jobType: row.job_type,
    walletAddress: row.wallet_address,
    level: row.level,
    message: row.message,
    metadata: row.metadata ?? {},
    occurredAt: new Date(row.occurred_at).getTime(),
  };
}

const UNIQUE_VIOLATION = "23505";

export class JobRunConflictError extends Error {
  constructor() {
    super("job_runs unique constraint violation");
    this.name = "JobRunConflictError";
  }
}

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireServerEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

/** Test-only: force a fresh client on next use. */
export function resetSupabaseJobsClientForTests(): void {
  cachedClient = null;
}

export class SupabaseJobsBackend implements JobsBackend {
  async findJobRun(
    jobType: JobType,
    externalRef: string
  ): Promise<JobRun | null> {
    const { data, error } = await getClient()
      .from("job_runs")
      .select("*")
      .eq("job_type", jobType)
      .eq("external_ref", externalRef)
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobRun(data as JobRunRow) : null;
  }

  async getJobRun(id: string): Promise<JobRun | null> {
    const { data, error } = await getClient()
      .from("job_runs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobRun(data as JobRunRow) : null;
  }

  async listJobRuns(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<JobRun[]> {
    let query = getClient()
      .from("job_runs")
      .select("*")
      .eq("job_type", jobType);
    if (walletAddress) query = query.eq("wallet_address", walletAddress);
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });
    if (error) throw error;
    return ((data ?? []) as JobRunRow[]).map(mapJobRun);
  }

  async insertJobRun(row: {
    jobType: JobType;
    externalRef: string;
    walletAddress: string | null;
    payload: Record<string, unknown>;
  }): Promise<JobRun> {
    const { data, error } = await getClient()
      .from("job_runs")
      .insert({
        job_type: row.jobType,
        external_ref: row.externalRef,
        wallet_address: row.walletAddress,
        payload: row.payload,
      })
      .select("*")
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new JobRunConflictError();
      throw error;
    }
    return mapJobRun(data as JobRunRow);
  }

  async resetJobRun(
    id: string,
    payload: Record<string, unknown>
  ): Promise<JobRun> {
    const { data, error } = await getClient()
      .from("job_runs")
      .update({
        status: "pending",
        payload,
        error: null,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return mapJobRun(data as JobRunRow);
  }

  async insertSteps(jobId: string, steps: StepDefinition[]): Promise<void> {
    if (steps.length === 0) return;
    const { error } = await getClient()
      .from("job_steps")
      .insert(
        steps.map((step, index) => ({
          job_id: jobId,
          step_index: index,
          kind: step.kind,
          input: step.input ?? {},
        }))
      );
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  }

  async resetSteps(jobId: string, steps: StepDefinition[]): Promise<void> {
    const client = getClient();
    const { error: deleteError } = await client
      .from("job_steps")
      .delete()
      .eq("job_id", jobId);
    if (deleteError) throw deleteError;
    await this.insertSteps(jobId, steps);
  }

  async listSteps(jobId: string): Promise<JobStep[]> {
    const { data, error } = await getClient()
      .from("job_steps")
      .select("*")
      .eq("job_id", jobId)
      .order("step_index", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as JobStepRow[]).map(mapJobStep);
  }

  async acquireLease(
    jobId: string,
    owner: string,
    nowIso: string,
    expiresIso: string
  ): Promise<JobRun | null> {
    const { data, error } = await getClient()
      .from("job_runs")
      .update({
        lease_owner: owner,
        lease_expires_at: expiresIso,
        updated_at: nowIso,
      })
      .eq("id", jobId)
      .or(`lease_owner.is.null,lease_expires_at.lt.${nowIso}`)
      .not("status", "in", "(completed,cancelled)")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobRun(data as JobRunRow) : null;
  }

  async releaseLease(jobId: string, owner: string): Promise<void> {
    const { error } = await getClient()
      .from("job_runs")
      .update({ lease_owner: null, lease_expires_at: null })
      .eq("id", jobId)
      .eq("lease_owner", owner);
    if (error) throw error;
  }

  async setJobStatus(
    jobId: string,
    status: JobStatus,
    error: string | null
  ): Promise<void> {
    const { error: updateError } = await getClient()
      .from("job_runs")
      .update({ status, error, updated_at: new Date().toISOString() })
      .eq("id", jobId);
    if (updateError) throw updateError;
  }

  async claimStep(
    jobId: string,
    index: number,
    nowIso: string
  ): Promise<JobStep | null> {
    const { data, error } = await getClient()
      .from("job_steps")
      .update({ status: "running", started_at: nowIso, updated_at: nowIso })
      .eq("job_id", jobId)
      .eq("step_index", index)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapJobStep(data as JobStepRow) : null;
  }

  async completeStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>,
    nowIso: string
  ): Promise<JobStep> {
    const { data, error } = await getClient()
      .from("job_steps")
      .update({
        status: "completed",
        result,
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("job_id", jobId)
      .eq("step_index", index)
      .select("*")
      .single();
    if (error) throw error;
    return mapJobStep(data as JobStepRow);
  }

  async failStep(
    jobId: string,
    index: number,
    result: Record<string, unknown>,
    nowIso: string
  ): Promise<JobStep> {
    const { data, error } = await getClient()
      .from("job_steps")
      .update({
        status: "failed",
        result,
        completed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("job_id", jobId)
      .eq("step_index", index)
      .select("*")
      .single();
    if (error) throw error;
    return mapJobStep(data as JobStepRow);
  }

  async skipStepsAfter(jobId: string, index: number): Promise<void> {
    const { error } = await getClient()
      .from("job_steps")
      .update({ status: "skipped", updated_at: new Date().toISOString() })
      .eq("job_id", jobId)
      .eq("status", "pending")
      .gt("step_index", index);
    if (error) throw error;
  }

  async reclaimRunningSteps(jobId: string): Promise<void> {
    const { error } = await getClient()
      .from("job_steps")
      .update({
        status: "pending",
        started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("job_id", jobId)
      .eq("status", "running");
    if (error) throw error;
  }

  async appendActionLog(entry: {
    jobId: string | null;
    jobType: JobType;
    walletAddress: string | null;
    level: ActionLogLevel;
    message: string;
    metadata: Record<string, unknown>;
  }): Promise<ActionLogEntryRow> {
    const { data, error } = await getClient()
      .from("action_log_entries")
      .insert({
        job_id: entry.jobId,
        job_type: entry.jobType,
        wallet_address: entry.walletAddress,
        level: entry.level,
        message: entry.message,
        metadata: entry.metadata,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapActionLog(data as ActionLogRow);
  }

  async listActionLog(
    jobType: JobType,
    walletAddress?: string | null
  ): Promise<ActionLogEntryRow[]> {
    let query = getClient()
      .from("action_log_entries")
      .select("*")
      .eq("job_type", jobType);
    if (walletAddress) query = query.eq("wallet_address", walletAddress);
    const { data, error } = await query.order("occurred_at", {
      ascending: true,
    });
    if (error) throw error;
    return ((data ?? []) as ActionLogRow[]).map(mapActionLog);
  }
}
