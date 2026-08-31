import { promises as fs } from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env.server";
import type {
  CoordinatorRun,
  CoordinatorRunStatus,
  CoordinatorStepRecord,
  DelegationGrant,
  DelegationStatus,
  DelegationTrancheRecord,
} from "./types";

/**
 * The durable job-ledger primitive the coordinator is built on (Scope §5).
 *
 * Production uses SupabaseCoordinatorLedgerStore (Postgres via the service
 * role). FileCoordinatorLedgerStore remains as a local/dev file-backed
 * option (atomic write-temp-then-rename per record), and
 * InMemoryCoordinatorLedgerStore is what tests use to exercise the same
 * contract without touching disk or the network.
 */
export interface CoordinatorLedgerStore {
  getGrant(positionId: string): Promise<DelegationGrant | null>;
  saveGrant(grant: DelegationGrant): Promise<void>;
  listActiveGrants(): Promise<DelegationGrant[]>;

  getRun(runId: string): Promise<CoordinatorRun | null>;
  saveRun(run: CoordinatorRun): Promise<void>;
  /** For crash-resume: an existing run for this position still in progress, if any. */
  findInProgressRunForPosition(
    positionId: string
  ): Promise<CoordinatorRun | null>;
  listRunsForPosition(positionId: string): Promise<CoordinatorRun[]>;
}

function safeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * File-backed ledger: one JSON file per grant (keyed by positionId) and per
 * run (keyed by runId), plus a small per-position index of run ids so
 * `findInProgressRunForPosition` doesn't need to scan the whole directory.
 * Every write is atomic (temp file + rename) so a crash mid-write can never
 * leave a torn/partial record behind for the next resume to read.
 */
export class FileCoordinatorLedgerStore implements CoordinatorLedgerStore {
  constructor(
    private readonly baseDir: string = process.env.LEVERAGE_LEDGER_DIR ??
      path.join(process.cwd(), ".data", "leverage-coordinator")
  ) {}

  private grantPath(positionId: string): string {
    return path.join(
      this.baseDir,
      "grants",
      `${safeFileName(positionId)}.json`
    );
  }

  private runPath(runId: string): string {
    return path.join(this.baseDir, "runs", `${safeFileName(runId)}.json`);
  }

  private runIndexPath(positionId: string): string {
    return path.join(
      this.baseDir,
      "run-index",
      `${safeFileName(positionId)}.json`
    );
  }

  async getGrant(positionId: string): Promise<DelegationGrant | null> {
    return readJsonIfExists<DelegationGrant>(this.grantPath(positionId));
  }

  async saveGrant(grant: DelegationGrant): Promise<void> {
    await atomicWriteJson(this.grantPath(grant.positionId), grant);
  }

  async listActiveGrants(): Promise<DelegationGrant[]> {
    const dir = path.join(this.baseDir, "grants");
    let files: string[];
    try {
      files = await fs.readdir(dir);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
    const grants = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map((f) => readJsonIfExists<DelegationGrant>(path.join(dir, f)))
    );
    return grants.filter(
      (g): g is DelegationGrant => g != null && g.status === "active"
    );
  }

  async getRun(runId: string): Promise<CoordinatorRun | null> {
    return readJsonIfExists<CoordinatorRun>(this.runPath(runId));
  }

  async saveRun(run: CoordinatorRun): Promise<void> {
    await atomicWriteJson(this.runPath(run.id), run);
    const index =
      (await readJsonIfExists<string[]>(this.runIndexPath(run.positionId))) ??
      [];
    if (!index.includes(run.id)) {
      index.push(run.id);
      await atomicWriteJson(this.runIndexPath(run.positionId), index);
    }
  }

  async findInProgressRunForPosition(
    positionId: string
  ): Promise<CoordinatorRun | null> {
    const runs = await this.listRunsForPosition(positionId);
    return runs.find((r) => r.status === "in_progress") ?? null;
  }

  async listRunsForPosition(positionId: string): Promise<CoordinatorRun[]> {
    const index =
      (await readJsonIfExists<string[]>(this.runIndexPath(positionId))) ?? [];
    const runs = await Promise.all(index.map((id) => this.getRun(id)));
    return runs.filter((r): r is CoordinatorRun => r != null);
  }
}

/** In-process store for tests and for exercising the coordinator without touching disk. */
export class InMemoryCoordinatorLedgerStore implements CoordinatorLedgerStore {
  private grants = new Map<string, DelegationGrant>();
  private runs = new Map<string, CoordinatorRun>();

  async getGrant(positionId: string): Promise<DelegationGrant | null> {
    return this.grants.get(positionId) ?? null;
  }

  async saveGrant(grant: DelegationGrant): Promise<void> {
    this.grants.set(grant.positionId, structuredClone(grant));
  }

  async listActiveGrants(): Promise<DelegationGrant[]> {
    return [...this.grants.values()].filter((g) => g.status === "active");
  }

  async getRun(runId: string): Promise<CoordinatorRun | null> {
    const run = this.runs.get(runId);
    return run ? structuredClone(run) : null;
  }

  async saveRun(run: CoordinatorRun): Promise<void> {
    this.runs.set(run.id, structuredClone(run));
  }

  async findInProgressRunForPosition(
    positionId: string
  ): Promise<CoordinatorRun | null> {
    const runs = await this.listRunsForPosition(positionId);
    return runs.find((r) => r.status === "in_progress") ?? null;
  }

  async listRunsForPosition(positionId: string): Promise<CoordinatorRun[]> {
    return [...this.runs.values()].filter((r) => r.positionId === positionId);
  }
}

// ─── Supabase row <-> domain mapping ─────────────────────────────────────────

interface CoordinatorGrantRow {
  position_id: string;
  id: string;
  wallet_address: string;
  asset_code: string;
  borrow_asset_code: string;
  status: DelegationStatus;
  created_at: string;
  revoked_at: string | null;
  expires_at: string;
  tranches: DelegationTrancheRecord[];
  consumed_tranche_ids: string[];
  guard_config: { deleverageThreshold: number; hysteresis: number };
  breached: boolean;
  updated_at: string;
}

interface CoordinatorRunRow {
  id: string;
  position_id: string;
  grant_id: string;
  reason: "deleverage-guard";
  triggered_at: string;
  updated_at: string;
  completed_at: string | null;
  status: CoordinatorRunStatus;
  health_factor_at_trigger: number | string | null;
  health_factor_target: number | string;
  tranche_ids_planned: string[];
  steps: CoordinatorStepRecord[];
}

function mapGrantRow(row: CoordinatorGrantRow): DelegationGrant {
  return {
    id: row.id,
    positionId: row.position_id,
    walletAddress: row.wallet_address,
    assetCode: row.asset_code,
    borrowAssetCode: row.borrow_asset_code,
    status: row.status,
    createdAt: new Date(row.created_at).getTime(),
    ...(row.revoked_at
      ? { revokedAt: new Date(row.revoked_at).getTime() }
      : {}),
    expiresAt: new Date(row.expires_at).getTime(),
    tranches: row.tranches ?? [],
    consumedTrancheIds: row.consumed_tranche_ids ?? [],
    guardConfig: row.guard_config,
    breached: row.breached,
  };
}

function grantToRow(grant: DelegationGrant): CoordinatorGrantRow {
  return {
    position_id: grant.positionId,
    id: grant.id,
    wallet_address: grant.walletAddress,
    asset_code: grant.assetCode,
    borrow_asset_code: grant.borrowAssetCode,
    status: grant.status,
    created_at: new Date(grant.createdAt).toISOString(),
    revoked_at:
      grant.revokedAt != null ? new Date(grant.revokedAt).toISOString() : null,
    expires_at: new Date(grant.expiresAt).toISOString(),
    tranches: grant.tranches,
    consumed_tranche_ids: grant.consumedTrancheIds,
    guard_config: grant.guardConfig,
    breached: grant.breached,
    updated_at: new Date().toISOString(),
  };
}

function mapRunRow(row: CoordinatorRunRow): CoordinatorRun {
  return {
    id: row.id,
    positionId: row.position_id,
    grantId: row.grant_id,
    reason: row.reason,
    triggeredAt: new Date(row.triggered_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    ...(row.completed_at
      ? { completedAt: new Date(row.completed_at).getTime() }
      : {}),
    status: row.status,
    healthFactorAtTrigger:
      row.health_factor_at_trigger != null
        ? Number(row.health_factor_at_trigger)
        : null,
    healthFactorTarget: Number(row.health_factor_target),
    trancheIdsPlanned: row.tranche_ids_planned ?? [],
    steps: row.steps ?? [],
  };
}

function runToRow(run: CoordinatorRun): CoordinatorRunRow {
  return {
    id: run.id,
    position_id: run.positionId,
    grant_id: run.grantId,
    reason: run.reason,
    triggered_at: new Date(run.triggeredAt).toISOString(),
    updated_at: new Date(run.updatedAt).toISOString(),
    completed_at:
      run.completedAt != null ? new Date(run.completedAt).toISOString() : null,
    status: run.status,
    health_factor_at_trigger: run.healthFactorAtTrigger,
    health_factor_target: run.healthFactorTarget,
    tranche_ids_planned: run.trancheIdsPlanned,
    steps: run.steps,
  };
}

let cachedCoordinatorClient: SupabaseClient | null = null;

function getCoordinatorClient(): SupabaseClient {
  if (cachedCoordinatorClient) return cachedCoordinatorClient;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireServerEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  cachedCoordinatorClient = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
  return cachedCoordinatorClient;
}

/**
 * Postgres-backed ledger via Supabase service role. One row per grant
 * (keyed by position_id) and per run (keyed by id); upserts replace the
 * full row so last write wins, matching FileCoordinatorLedgerStore's
 * atomicWriteJson semantics.
 */
export class SupabaseCoordinatorLedgerStore implements CoordinatorLedgerStore {
  async getGrant(positionId: string): Promise<DelegationGrant | null> {
    const { data, error } = await getCoordinatorClient()
      .from("coordinator_delegation_grants")
      .select("*")
      .eq("position_id", positionId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapGrantRow(data as CoordinatorGrantRow) : null;
  }

  async saveGrant(grant: DelegationGrant): Promise<void> {
    const { error } = await getCoordinatorClient()
      .from("coordinator_delegation_grants")
      .upsert(grantToRow(grant), { onConflict: "position_id" });
    if (error) throw error;
  }

  async listActiveGrants(): Promise<DelegationGrant[]> {
    const { data, error } = await getCoordinatorClient()
      .from("coordinator_delegation_grants")
      .select("*")
      .eq("status", "active");
    if (error) throw error;
    return ((data ?? []) as CoordinatorGrantRow[]).map(mapGrantRow);
  }

  async getRun(runId: string): Promise<CoordinatorRun | null> {
    const { data, error } = await getCoordinatorClient()
      .from("coordinator_runs")
      .select("*")
      .eq("id", runId)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRunRow(data as CoordinatorRunRow) : null;
  }

  async saveRun(run: CoordinatorRun): Promise<void> {
    const { error } = await getCoordinatorClient()
      .from("coordinator_runs")
      .upsert(runToRow(run), { onConflict: "id" });
    if (error) throw error;
  }

  async findInProgressRunForPosition(
    positionId: string
  ): Promise<CoordinatorRun | null> {
    const { data, error } = await getCoordinatorClient()
      .from("coordinator_runs")
      .select("*")
      .eq("position_id", positionId)
      .eq("status", "in_progress")
      .order("triggered_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? mapRunRow(data as CoordinatorRunRow) : null;
  }

  async listRunsForPosition(positionId: string): Promise<CoordinatorRun[]> {
    const { data, error } = await getCoordinatorClient()
      .from("coordinator_runs")
      .select("*")
      .eq("position_id", positionId)
      .order("triggered_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as CoordinatorRunRow[]).map(mapRunRow);
  }
}

let sharedStore: CoordinatorLedgerStore | null = null;

/** Process-wide singleton for API routes — one Supabase-backed store per server process. */
export function getCoordinatorLedgerStore(): CoordinatorLedgerStore {
  sharedStore ??= new SupabaseCoordinatorLedgerStore();
  return sharedStore;
}
