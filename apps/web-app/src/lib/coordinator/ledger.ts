import { promises as fs } from "fs";
import path from "path";
import type { CoordinatorRun, DelegationGrant } from "./types";

/**
 * The durable job-ledger primitive the coordinator is built on (Scope §5).
 *
 * This repo doesn't have a real database — app/api/automation/* (the
 * closest existing "durable job" precedent) is an explicitly-labeled
 * in-memory demo store ("swap for a real DB in production"), and
 * app/api/vault/invest/route.ts persists nothing at all between
 * invocations beyond an in-memory cooldown timestamp. Since the
 * coordinator's crash-resumption requirement is meaningless against a
 * store that doesn't survive a process restart, this is a real
 * file-backed store (atomic write-temp-then-rename per record) rather
 * than another in-memory Map — the interface below is the swap-in point for
 * a real database in production, and InMemoryCoordinatorLedgerStore below
 * is what tests use to exercise the same contract without touching disk.
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

let sharedStore: CoordinatorLedgerStore | null = null;

/** Process-wide singleton for API routes — one file-backed store per server process. */
export function getCoordinatorLedgerStore(): CoordinatorLedgerStore {
  sharedStore ??= new FileCoordinatorLedgerStore();
  return sharedStore;
}
