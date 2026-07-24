// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  strategyStorageSchema,
  executionHistoryStorageSchema,
  CURRENT_STRATEGY_STORAGE_VERSION,
  CURRENT_EXECUTION_STORAGE_VERSION,
  migrateDocument,
  migrateStrategyDocument,
  migrateExecutionHistoryDocument,
  loadStrategyDocument,
  listStrategies,
  upsertStrategy,
  removeStrategy,
  loadExecutionHistoryDocument,
  listExecutions,
  upsertExecution,
  findUnfinishedExecutions,
  type MigrationFn,
} from "../persistence";
import type { ExecutionRecord, Strategy } from "../types";

// ─── Schema ──────────────────────────────────────────────────────────────────

const validStrategyDoc = {
  version: CURRENT_STRATEGY_STORAGE_VERSION,
  strategies: [
    {
      id: "s1",
      version: 1,
      name: "Swap then Deposit",
      isTemplate: true,
      steps: [
        {
          id: "a",
          type: "swap",
          protocol: "soroswap",
          label: "Swap",
          params: {
            tokenIn: { source: "literal", value: "XLM" },
            tokenOut: { source: "literal", value: "USDC" },
          },
          dependsOn: [],
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    },
  ],
};

describe("strategyStorageSchema", () => {
  it("accepts a well-formed document, forward-compatible steps, and both binding kinds", () => {
    expect(strategyStorageSchema.safeParse(validStrategyDoc).success).toBe(
      true
    );

    const forwardCompat = {
      ...validStrategyDoc,
      strategies: [
        {
          ...validStrategyDoc.strategies[0],
          steps: [
            {
              id: "future",
              type: "teleport",
              protocol: "futureProtocol",
              label: "Future step",
              params: {},
              dependsOn: [],
            },
          ],
        },
      ],
    };
    expect(strategyStorageSchema.safeParse(forwardCompat).success).toBe(true);

    const boundBinding = {
      ...validStrategyDoc,
      strategies: [
        {
          ...validStrategyDoc.strategies[0],
          steps: [
            {
              id: "a",
              type: "swap",
              protocol: "soroswap",
              label: "Swap",
              params: {
                bound: {
                  source: "stepOutput",
                  stepId: "x",
                  portId: "out.amount",
                },
              },
              dependsOn: ["x"],
            },
          ],
        },
      ],
    };
    expect(strategyStorageSchema.safeParse(boundBinding).success).toBe(true);
  });

  it("rejects a document missing required fields or with an invalid param binding shape", () => {
    expect(strategyStorageSchema.safeParse({ strategies: [] }).success).toBe(
      false
    );
    const badBinding = {
      ...validStrategyDoc,
      strategies: [
        {
          ...validStrategyDoc.strategies[0],
          steps: [
            {
              id: "a",
              type: "swap",
              protocol: "soroswap",
              label: "Swap",
              params: { bad: { source: "nonsense" } },
              dependsOn: [],
            },
          ],
        },
      ],
    };
    expect(strategyStorageSchema.safeParse(badBinding).success).toBe(false);
  });
});

describe("executionHistoryStorageSchema", () => {
  it("accepts a well-formed execution record and rejects an unrecognized status", () => {
    const doc = {
      version: 1,
      executions: [
        {
          id: "e1",
          strategyId: "s1",
          strategySnapshot: {},
          status: "in_progress",
          startedAt: 0,
          updatedAt: 0,
          projectedOutcome: {},
          steps: [{ stepId: "a", status: "completed", txHash: "abc" }],
        },
      ],
    };
    expect(executionHistoryStorageSchema.safeParse(doc).success).toBe(true);
    const bad = {
      ...doc,
      executions: [{ ...doc.executions[0], status: "not-a-real-status" }],
    };
    expect(executionHistoryStorageSchema.safeParse(bad).success).toBe(false);
  });
});

// ─── Migrations ──────────────────────────────────────────────────────────────

describe("migrateDocument — generic mechanics", () => {
  it("applies a single migration, chains multiple, and leaves an already-current document untouched", () => {
    const single: Record<number, MigrationFn> = {
      0: (doc) => ({ ...doc, version: 1, isTemplate: doc.isTemplate ?? false }),
    };
    const migrated = migrateDocument({ strategies: [] }, 1, single) as {
      version: number;
      isTemplate: boolean;
    };
    expect(migrated).toMatchObject({ version: 1, isTemplate: false });

    const chained: Record<number, MigrationFn> = {
      0: (doc) => ({ ...doc, version: 1, addedInV1: true }),
      1: (doc) => ({ ...doc, version: 2, addedInV2: true }),
    };
    expect(migrateDocument({ version: 0 }, 2, chained)).toMatchObject({
      version: 2,
      addedInV1: true,
      addedInV2: true,
    });

    const shouldNotRun: Record<number, MigrationFn> = {
      0: () => {
        throw new Error("should not run");
      },
    };
    const current = { version: 2, foo: "bar" };
    expect(migrateDocument(current, 2, shouldNotRun)).toEqual(current);
  });

  it("stops without throwing when no migration is registered, treats a missing version as 0, and never infinite-loops", () => {
    expect(migrateDocument({ version: 0 }, 5, {})).toEqual({ version: 0 });
    const treatsMissingAsV0: Record<number, MigrationFn> = {
      0: (doc) => ({ ...doc, version: 1 }),
    };
    expect(migrateDocument({}, 1, treatsMissingAsV0)).toEqual({ version: 1 });
    const buggy: Record<number, MigrationFn> = { 0: (doc) => ({ ...doc }) }; // never bumps version
    expect(migrateDocument({ version: 0 }, 3, buggy)).toBeDefined();
  });
});

describe("migrateStrategyDocument / migrateExecutionHistoryDocument", () => {
  it("are no-ops today (v1 is the first shipped version)", () => {
    expect(migrateStrategyDocument({ version: 1, strategies: [] }, 1)).toEqual({
      version: 1,
      strategies: [],
    });
    expect(
      migrateExecutionHistoryDocument({ version: 1, executions: [] }, 1)
    ).toEqual({ version: 1, executions: [] });
  });
});

// ─── Strategy storage ────────────────────────────────────────────────────────

const WALLET_A = "GALICE";
const WALLET_B = "GBOB";

function strategy(id: string, overrides: Partial<Strategy> = {}): Strategy {
  return {
    id,
    version: 1,
    name: `Strategy ${id}`,
    isTemplate: false,
    steps: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("strategyStorage", () => {
  it("returns an empty current-version document when nothing is stored, and round-trips a saved strategy", () => {
    expect(loadStrategyDocument(WALLET_A)).toEqual({
      version: CURRENT_STRATEGY_STORAGE_VERSION,
      strategies: [],
    });
    upsertStrategy(WALLET_A, strategy("s1"));
    expect(listStrategies(WALLET_A)).toEqual([strategy("s1")]);
  });

  it("updates in place rather than duplicating, removes by id, and isolates storage per wallet", () => {
    upsertStrategy(WALLET_A, strategy("s1", { name: "Original" }));
    upsertStrategy(WALLET_A, strategy("s1", { name: "Renamed" }));
    expect(listStrategies(WALLET_A)).toHaveLength(1);
    expect(listStrategies(WALLET_A)[0].name).toBe("Renamed");

    upsertStrategy(WALLET_A, strategy("s2"));
    removeStrategy(WALLET_A, "s1");
    expect(listStrategies(WALLET_A).map((s) => s.id)).toEqual(["s2"]);
    expect(listStrategies(WALLET_B)).toEqual([]);
  });

  it("preserves an unrecognized step type verbatim on save/reload (forward compatibility)", () => {
    const withUnknownStep = strategy("s1", {
      steps: [
        {
          id: "future",
          type: "teleport" as never,
          protocol: "futureProtocol",
          label: "Future step",
          params: {},
          dependsOn: [],
        },
      ],
    });
    upsertStrategy(WALLET_A, withUnknownStep);
    expect(listStrategies(WALLET_A)[0].steps[0]).toMatchObject({
      type: "teleport",
      protocol: "futureProtocol",
    });
  });

  it("resets to empty rather than throwing on corrupt JSON or a schema-invalid shape with no migration path", () => {
    window.localStorage.setItem(
      `neko_defi_strategies_${WALLET_A}`,
      "{not json"
    );
    expect(() => loadStrategyDocument(WALLET_A)).not.toThrow();
    expect(listStrategies(WALLET_A)).toEqual([]);

    window.localStorage.setItem(
      `neko_defi_strategies_${WALLET_A}`,
      JSON.stringify({ version: 1, strategies: [{ totally: "wrong shape" }] })
    );
    expect(listStrategies(WALLET_A)).toEqual([]);
  });
});

// ─── Execution history storage ───────────────────────────────────────────────

function execution(
  id: string,
  overrides: Partial<ExecutionRecord> = {}
): ExecutionRecord {
  return {
    id,
    strategyId: "s1",
    strategySnapshot: {},
    status: "in_progress",
    startedAt: 0,
    updatedAt: 0,
    projectedOutcome: {},
    steps: [],
    ...overrides,
  };
}

describe("executionHistoryStorage", () => {
  it("returns an empty current-version document, round-trips, and upserts by id", () => {
    expect(loadExecutionHistoryDocument(WALLET_A)).toEqual({
      version: CURRENT_EXECUTION_STORAGE_VERSION,
      executions: [],
    });
    upsertExecution(WALLET_A, execution("e1"));
    expect(listExecutions(WALLET_A)).toEqual([execution("e1")]);
    upsertExecution(WALLET_A, execution("e1", { status: "completed" }));
    expect(listExecutions(WALLET_A)).toHaveLength(1);
    expect(listExecutions(WALLET_A)[0].status).toBe("completed");
  });

  it("never deletes history — an abandoned execution stays recorded", () => {
    upsertExecution(WALLET_A, execution("e1", { status: "in_progress" }));
    upsertExecution(WALLET_A, execution("e1", { status: "abandoned" }));
    expect(listExecutions(WALLET_A)).toHaveLength(1);
    expect(listExecutions(WALLET_A)[0].status).toBe("abandoned");
  });

  it("findUnfinishedExecutions returns only in_progress / paused-deviation records", () => {
    upsertExecution(WALLET_A, execution("done", { status: "completed" }));
    upsertExecution(WALLET_A, execution("running", { status: "in_progress" }));
    upsertExecution(
      WALLET_A,
      execution("paused", { status: "paused-deviation" })
    );
    upsertExecution(WALLET_A, execution("gone", { status: "abandoned" }));
    expect(
      findUnfinishedExecutions(WALLET_A)
        .map((e) => e.id)
        .sort()
    ).toEqual(["paused", "running"]);
  });

  it("preserves per-step tx hashes and actualOutputs for reconciliation on reload", () => {
    upsertExecution(
      WALLET_A,
      execution("e1", {
        steps: [
          {
            stepId: "a",
            status: "completed",
            txHash: "abc123",
            actualOutputs: { "out.amount": "42" },
          },
        ],
      })
    );
    expect(listExecutions(WALLET_A)[0].steps[0]).toMatchObject({
      txHash: "abc123",
      actualOutputs: { "out.amount": "42" },
    });
  });
});
