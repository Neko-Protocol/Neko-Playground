import { z } from "zod";
import type { ExecutionRecord, Strategy } from "./types";

// ─── Schema ──────────────────────────────────────────────────────────────────

export const CURRENT_STRATEGY_STORAGE_VERSION = 1;
export const CURRENT_EXECUTION_STORAGE_VERSION = 1;

const paramBindingSchema = z.union([
  z.object({ source: z.literal("literal"), value: z.unknown() }),
  z.object({
    source: z.literal("stepOutput"),
    stepId: z.string(),
    portId: z.string(),
  }),
]);

/**
 * `type`/`protocol` are intentionally z.string(), not the current StepType
 * enum — a stored strategy referencing a step type this build doesn't know
 * about (an older build opening newer data, or vice versa) must still parse
 * successfully. Resolving it to something executable is the registry's job
 * (StrategyStepRegistry.resolveOrUnknown), not the storage schema's.
 */
const strategyStepSchema = z.object({
  id: z.string(),
  type: z.string(),
  protocol: z.string(),
  label: z.string(),
  params: z.record(z.string(), paramBindingSchema),
  dependsOn: z.array(z.string()),
});

const strategySchema = z.object({
  id: z.string(),
  version: z.number(),
  name: z.string(),
  description: z.string().optional(),
  isTemplate: z.boolean(),
  steps: z.array(strategyStepSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const strategyStorageSchema = z.object({
  version: z.number(),
  strategies: z.array(strategySchema),
});

const executionStepStatusSchema = z.enum([
  "pending",
  "preparing",
  "awaiting_signature",
  "submitting",
  "confirming",
  "completed",
  "failed",
  "paused_deviation",
  "cancelled",
]);

const deviationReportSchema = z.object({
  deviated: z.boolean(),
  relativeDeviation: z.number().nullable(),
  threshold: z.number(),
  message: z.string().optional(),
});

const executionStepRecordSchema = z.object({
  stepId: z.string(),
  status: executionStepStatusSchema,
  txHash: z.string().optional(),
  submittedAt: z.number().optional(),
  confirmedAt: z.number().optional(),
  actualOutputs: z.record(z.string(), z.unknown()).optional(),
  deviation: deviationReportSchema.optional(),
  errorMessage: z.string().optional(),
});

const executionStatusSchema = z.enum([
  "in_progress",
  "completed",
  "failed",
  "paused-deviation",
  "abandoned",
]);

const executionRecordSchema = z.object({
  id: z.string(),
  strategyId: z.string(),
  strategySnapshot: z.unknown(),
  status: executionStatusSchema,
  startedAt: z.number(),
  updatedAt: z.number(),
  completedAt: z.number().optional(),
  projectedOutcome: z.unknown(),
  actualOutcome: z.unknown().optional(),
  steps: z.array(executionStepRecordSchema),
});

export const executionHistoryStorageSchema = z.object({
  version: z.number(),
  executions: z.array(executionRecordSchema),
});

export type StoredStrategyDocument = z.infer<typeof strategyStorageSchema>;
export type StoredExecutionHistoryDocument = z.infer<
  typeof executionHistoryStorageSchema
>;

// ─── Migrations ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MigrationFn = (doc: any) => any;

function currentVersionOf(doc: unknown): number {
  const v = (doc as { version?: unknown } | null | undefined)?.version;
  return typeof v === "number" ? v : 0;
}

/**
 * Ordered migrations for each document, keyed by the version being
 * migrated FROM. Applied repeatedly until the document reports the target
 * version or no further migration is registered (the caller's schema parse
 * then accepts or rejects the result). Empty today (schema v1 is the first
 * version) — the framework itself is proven with a synthetic v0 fixture in
 * the test suite, ahead of ever needing it for real.
 */
export const STRATEGY_MIGRATIONS: Record<number, MigrationFn> = {};
export const EXECUTION_HISTORY_MIGRATIONS: Record<number, MigrationFn> = {};

export function migrateDocument(
  raw: unknown,
  targetVersion: number,
  migrations: Record<number, MigrationFn>
): unknown {
  let doc = raw;
  let fromVersion = currentVersionOf(doc);
  const seen = new Set<number>();

  while (fromVersion < targetVersion) {
    if (seen.has(fromVersion)) break; // guard against a misconfigured migration loop
    seen.add(fromVersion);
    const migrate = migrations[fromVersion];
    if (!migrate) break;
    doc = migrate(doc);
    const nextVersion = currentVersionOf(doc);
    fromVersion = nextVersion > fromVersion ? nextVersion : fromVersion + 1;
  }

  return doc;
}

export function migrateStrategyDocument(
  raw: unknown,
  targetVersion: number
): unknown {
  return migrateDocument(raw, targetVersion, STRATEGY_MIGRATIONS);
}

export function migrateExecutionHistoryDocument(
  raw: unknown,
  targetVersion: number
): unknown {
  return migrateDocument(raw, targetVersion, EXECUTION_HISTORY_MIGRATIONS);
}

// ─── Strategy storage ────────────────────────────────────────────────────────

/**
 * Unlike features/swap/hooks/useLimitOrders.ts, the version is NOT baked
 * into the key — a stable key lets migrateStrategyDocument() upgrade
 * old-version data in place instead of orphaning it under a key the app
 * never reads again. Version travels inside the stored payload only.
 */
function strategyStorageKey(walletAddress: string): string {
  return `neko_defi_strategies_${walletAddress}`;
}

function emptyStrategyDocument(): StoredStrategyDocument {
  return { version: CURRENT_STRATEGY_STORAGE_VERSION, strategies: [] };
}

export function loadStrategyDocument(
  walletAddress: string
): StoredStrategyDocument {
  if (typeof window === "undefined" || !window.localStorage)
    return emptyStrategyDocument();
  try {
    const raw = window.localStorage.getItem(strategyStorageKey(walletAddress));
    if (!raw) return emptyStrategyDocument();
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateStrategyDocument(
      parsed,
      CURRENT_STRATEGY_STORAGE_VERSION
    );
    const result = strategyStorageSchema.safeParse(migrated);
    if (!result.success) {
      console.warn(
        "[strategyStorage] Corrupt or unmigratable strategies document, resetting.",
        result.error
      );
      return emptyStrategyDocument();
    }
    return result.data;
  } catch (err) {
    console.warn("[strategyStorage] Failed to load strategies:", err);
    return emptyStrategyDocument();
  }
}

export function saveStrategyDocument(
  walletAddress: string,
  doc: StoredStrategyDocument
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      strategyStorageKey(walletAddress),
      JSON.stringify(doc)
    );
  } catch (err) {
    console.warn("[strategyStorage] Failed to save strategies:", err);
  }
}

export function listStrategies(walletAddress: string): Strategy[] {
  return loadStrategyDocument(walletAddress).strategies as Strategy[];
}

export function upsertStrategy(
  walletAddress: string,
  strategy: Strategy
): Strategy[] {
  const doc = loadStrategyDocument(walletAddress);
  const idx = doc.strategies.findIndex((s) => s.id === strategy.id);
  const strategies = [...doc.strategies];
  if (idx === -1)
    strategies.push(strategy as StoredStrategyDocument["strategies"][number]);
  else
    strategies[idx] = strategy as StoredStrategyDocument["strategies"][number];
  const next: StoredStrategyDocument = {
    version: CURRENT_STRATEGY_STORAGE_VERSION,
    strategies,
  };
  saveStrategyDocument(walletAddress, next);
  return next.strategies as Strategy[];
}

export function removeStrategy(
  walletAddress: string,
  strategyId: string
): Strategy[] {
  const doc = loadStrategyDocument(walletAddress);
  const next: StoredStrategyDocument = {
    version: CURRENT_STRATEGY_STORAGE_VERSION,
    strategies: doc.strategies.filter((s) => s.id !== strategyId),
  };
  saveStrategyDocument(walletAddress, next);
  return next.strategies as Strategy[];
}

// ─── Execution history storage ───────────────────────────────────────────────

function executionStorageKey(walletAddress: string): string {
  return `neko_defi_strategy_executions_${walletAddress}`;
}

function emptyExecutionDocument(): StoredExecutionHistoryDocument {
  return { version: CURRENT_EXECUTION_STORAGE_VERSION, executions: [] };
}

export function loadExecutionHistoryDocument(
  walletAddress: string
): StoredExecutionHistoryDocument {
  if (typeof window === "undefined" || !window.localStorage)
    return emptyExecutionDocument();
  try {
    const raw = window.localStorage.getItem(executionStorageKey(walletAddress));
    if (!raw) return emptyExecutionDocument();
    const parsed: unknown = JSON.parse(raw);
    const migrated = migrateExecutionHistoryDocument(
      parsed,
      CURRENT_EXECUTION_STORAGE_VERSION
    );
    const result = executionHistoryStorageSchema.safeParse(migrated);
    if (!result.success) {
      console.warn(
        "[executionHistoryStorage] Corrupt or unmigratable execution history, resetting.",
        result.error
      );
      return emptyExecutionDocument();
    }
    return result.data;
  } catch (err) {
    console.warn(
      "[executionHistoryStorage] Failed to load execution history:",
      err
    );
    return emptyExecutionDocument();
  }
}

export function saveExecutionHistoryDocument(
  walletAddress: string,
  doc: StoredExecutionHistoryDocument
): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      executionStorageKey(walletAddress),
      JSON.stringify(doc)
    );
  } catch (err) {
    console.warn(
      "[executionHistoryStorage] Failed to save execution history:",
      err
    );
  }
}

export function listExecutions(walletAddress: string): ExecutionRecord[] {
  return loadExecutionHistoryDocument(walletAddress)
    .executions as ExecutionRecord[];
}

/**
 * Called after every completed step (per the guided execution engine) so an
 * interrupted app close never loses more than the in-flight step's result.
 * Upserts by id — never deletes, so execution history is preserved even
 * when the user later abandons the run.
 */
export function upsertExecution(
  walletAddress: string,
  execution: ExecutionRecord
): ExecutionRecord[] {
  const doc = loadExecutionHistoryDocument(walletAddress);
  const idx = doc.executions.findIndex((e) => e.id === execution.id);
  const executions = [...doc.executions];
  if (idx === -1)
    executions.push(
      execution as StoredExecutionHistoryDocument["executions"][number]
    );
  else
    executions[idx] =
      execution as StoredExecutionHistoryDocument["executions"][number];
  const next: StoredExecutionHistoryDocument = {
    version: CURRENT_EXECUTION_STORAGE_VERSION,
    executions,
  };
  saveExecutionHistoryDocument(walletAddress, next);
  return next.executions as ExecutionRecord[];
}

export function findUnfinishedExecutions(
  walletAddress: string
): ExecutionRecord[] {
  return listExecutions(walletAddress).filter(
    (e) => e.status === "in_progress" || e.status === "paused-deviation"
  );
}
