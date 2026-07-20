// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  checkDeviation,
  ExecutionEngine,
  reconcileExecution,
  findResumableExecutions,
  type ExecutionEngineDeps,
} from "../execution";
import { upsertExecution } from "../persistence";
import { StrategyStepRegistry } from "../registry";
import type {
  ExecutionRecord,
  Strategy,
  StrategyStep,
  StrategyStepDefinition,
  StepProjection,
} from "../types";

// ─── Deviation check ─────────────────────────────────────────────────────────

function projection(outputs: Record<string, unknown>): StepProjection {
  return { outputs, estimatedFee: "0", warnings: [] };
}

describe("checkDeviation", () => {
  it("reports no deviation within threshold, flags a breach with a message, and handles non-numeric/missing ports", () => {
    expect(
      checkDeviation("swap", projection({ "out.amount": "100" }), {
        "out.amount": "100",
      }).deviated
    ).toBe(false);
    expect(
      checkDeviation("swap", projection({ "out.amount": "100" }), {
        "out.amount": "97",
      }).deviated
    ).toBe(false); // within 5% swap threshold

    const breach = checkDeviation("swap", projection({ "out.amount": "100" }), {
      "out.amount": "80",
    });
    expect(breach.deviated).toBe(true);
    expect(breach.relativeDeviation).toBeCloseTo(0.2);
    expect(breach.message).toMatch(/deviates/);

    // vaultDeposit has no override -> defaultDeviationThreshold (3%)
    expect(
      checkDeviation("vaultDeposit", projection({ "out.dfTokens": "100" }), {
        "out.dfTokens": "96",
      }).deviated
    ).toBe(true);

    expect(
      checkDeviation("swap", projection({ "out.amount": "not-a-number" }), {
        "out.amount": "also-not-a-number",
      }).deviated
    ).toBe(false);
    expect(
      checkDeviation(
        "swap",
        projection({ "out.other": "not-a-number", "out.amount": "100" }),
        { "out.amount": "100" }
      ).deviated
    ).toBe(false);
  });
});

// ─── Execution engine ────────────────────────────────────────────────────────

function step(
  overrides: Partial<StrategyStep> & {
    id: string;
    type: string;
    protocol: string;
  }
): StrategyStep {
  return {
    label: overrides.id,
    params: {},
    dependsOn: [],
    ...overrides,
  } as StrategyStep;
}
function strategyWith(steps: StrategyStep[]): Strategy {
  return {
    id: "s1",
    version: 1,
    name: "Test",
    isTemplate: false,
    steps,
    createdAt: 0,
    updatedAt: 0,
  };
}
function freshRecord(strategy: Strategy): ExecutionRecord {
  return {
    id: "e1",
    strategyId: strategy.id,
    strategySnapshot: strategy,
    status: "in_progress",
    startedAt: 0,
    updatedAt: 0,
    projectedOutcome: { steps: {} },
    steps: [],
  };
}
function fakeDefinition(
  stepType: string,
  protocol: string,
  overrides: Partial<StrategyStepDefinition> = {}
): StrategyStepDefinition {
  return {
    stepType: stepType as StrategyStepDefinition["stepType"],
    protocol,
    submissionMode: "rpc",
    paramsSchema: z.object({}).passthrough(),
    describeOutputs: () => [],
    validate: () => [],
    simulate: async () => ({ outputs: {}, estimatedFee: "0", warnings: [] }),
    prepare: async () => ({ xdr: "UNSIGNED_XDR", networkPassphrase: "p" }),
    ...overrides,
  };
}
function baseDeps(
  overrides: Partial<ExecutionEngineDeps> = {}
): ExecutionEngineDeps {
  return {
    sign: vi.fn(async (xdr: string) => ({ signedTxXdr: `signed(${xdr})` })),
    transports: {
      rpc: {
        submit: vi.fn(async () => ({ hash: "HASH" })),
        confirm: vi.fn(async () => ({ status: "SUCCESS" })),
      },
      soroswapApi: {
        submit: vi.fn(async () => ({ hash: "SORO_HASH" })),
        confirm: vi.fn(async () => ({ status: "SUCCESS" })),
      },
    },
    ...overrides,
  };
}

describe("ExecutionEngine — sequential execution", () => {
  it("executes each step in dependency order, propagates actual outputs, and routes submission by submissionMode", async () => {
    const registry = new StrategyStepRegistry();
    const calls: string[] = [];
    registry.register(
      fakeDefinition("swap", "soroswap", {
        prepare: async () => {
          calls.push("prepare:a");
          return { xdr: "XDR_A", networkPassphrase: "p" };
        },
        interpretResult: async () => ({ outputs: { "out.amount": "42" } }),
      })
    );
    let receivedParams: unknown;
    registry.register(
      fakeDefinition("vaultDeposit", "defindex", {
        prepare: async (ctx) => {
          calls.push("prepare:b");
          receivedParams = ctx.resolvedParams;
          return { xdr: "XDR_B", networkPassphrase: "p" };
        },
      })
    );

    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
      step({
        id: "b",
        type: "vaultDeposit",
        protocol: "defindex",
        dependsOn: ["a"],
        params: {
          amount: { source: "stepOutput", stepId: "a", portId: "out.amount" },
        },
      }),
    ]);
    const deps = baseDeps();
    const result = await new ExecutionEngine({
      ...deps,
      registry,
    }).executeStrategy({
      strategy,
      execution: freshRecord(strategy),
      userAddress: "GUSER",
      networkPassphrase: "p",
    });

    expect(result.status).toBe("completed");
    expect(calls).toEqual(["prepare:a", "prepare:b"]);
    expect(receivedParams).toEqual({ amount: "42" });
    expect(result.record.steps.map((s) => s.status)).toEqual([
      "completed",
      "completed",
    ]);
    expect(deps.sign).toHaveBeenCalledTimes(2);
    expect(deps.transports.rpc.submit).toHaveBeenCalledTimes(2);

    const soroswapRegistry = new StrategyStepRegistry();
    soroswapRegistry.register(
      fakeDefinition("swap", "soroswap", { submissionMode: "soroswapApi" })
    );
    const soroDeps = baseDeps();
    const soroStrategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
    ]);
    await new ExecutionEngine({
      ...soroDeps,
      registry: soroswapRegistry,
    }).executeStrategy({
      strategy: soroStrategy,
      execution: freshRecord(soroStrategy),
      userAddress: "GUSER",
      networkPassphrase: "p",
    });
    expect(soroDeps.transports.soroswapApi.submit).toHaveBeenCalledTimes(1);
    expect(soroDeps.transports.rpc.submit).not.toHaveBeenCalled();
  });
});

describe("ExecutionEngine — deviation handling", () => {
  it("pauses instead of advancing when a step's actual result deviates beyond threshold", async () => {
    const registry = new StrategyStepRegistry();
    registry.register(
      fakeDefinition("swap", "soroswap", {
        interpretResult: async () => ({ outputs: { "out.amount": "80" } }),
      })
    ); // 20% below projection
    registry.register(fakeDefinition("vaultDeposit", "defindex"));

    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
      step({
        id: "b",
        type: "vaultDeposit",
        protocol: "defindex",
        dependsOn: ["a"],
      }),
    ]);
    const record = freshRecord(strategy);
    record.projectedOutcome = {
      steps: {
        a: {
          outputs: { "out.amount": "100" },
          estimatedFee: "0",
          warnings: [],
        },
      },
    };

    const result = await new ExecutionEngine({
      ...baseDeps(),
      registry,
    }).executeStrategy({
      strategy,
      execution: record,
      userAddress: "GUSER",
      networkPassphrase: "p",
    });
    expect(result.status).toBe("paused-deviation");
    expect(result.record.steps).toHaveLength(1); // step "b" never ran
    expect(result.record.steps[0]).toMatchObject({
      stepId: "a",
      status: "paused_deviation",
    });
  });

  it("resuming without acknowledgement re-pauses immediately without re-submitting", async () => {
    const registry = new StrategyStepRegistry();
    const prepareSpy = vi.fn(async () => ({
      xdr: "X",
      networkPassphrase: "p",
    }));
    registry.register(
      fakeDefinition("swap", "soroswap", { prepare: prepareSpy })
    );

    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
    ]);
    const pausedRecord = freshRecord(strategy);
    pausedRecord.status = "paused-deviation";
    pausedRecord.steps = [
      {
        stepId: "a",
        status: "paused_deviation",
        actualOutputs: { "out.amount": "80" },
        deviation: { deviated: true, relativeDeviation: 0.2, threshold: 0.05 },
      },
    ];

    const deps = baseDeps();
    const result = await new ExecutionEngine({
      ...deps,
      registry,
    }).executeStrategy({
      strategy,
      execution: pausedRecord,
      userAddress: "GUSER",
      networkPassphrase: "p",
    });
    expect(result.status).toBe("paused-deviation");
    expect(prepareSpy).not.toHaveBeenCalled();
    expect(deps.transports.rpc.submit).not.toHaveBeenCalled();
  });

  it("resuming with acknowledgement accepts the recorded result and continues without re-submitting that step", async () => {
    const registry = new StrategyStepRegistry();
    const prepareSpyA = vi.fn(async () => ({
      xdr: "X",
      networkPassphrase: "p",
    }));
    registry.register(
      fakeDefinition("swap", "soroswap", { prepare: prepareSpyA })
    );
    registry.register(fakeDefinition("vaultDeposit", "defindex"));

    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
      step({
        id: "b",
        type: "vaultDeposit",
        protocol: "defindex",
        dependsOn: ["a"],
      }),
    ]);
    const pausedRecord = freshRecord(strategy);
    pausedRecord.status = "paused-deviation";
    pausedRecord.steps = [
      {
        stepId: "a",
        status: "paused_deviation",
        actualOutputs: { "out.amount": "80" },
        deviation: { deviated: true, relativeDeviation: 0.2, threshold: 0.05 },
      },
    ];

    const result = await new ExecutionEngine({
      ...baseDeps(),
      registry,
    }).executeStrategy({
      strategy,
      execution: pausedRecord,
      userAddress: "GUSER",
      networkPassphrase: "p",
      acknowledgedDeviationStepIds: ["a"],
    });
    expect(result.status).toBe("completed");
    expect(prepareSpyA).not.toHaveBeenCalled();
    expect(result.record.steps.find((s) => s.stepId === "a")?.status).toBe(
      "completed"
    );
    expect(result.record.steps.find((s) => s.stepId === "b")?.status).toBe(
      "completed"
    );
  });
});

describe("ExecutionEngine — failure and recovery", () => {
  it("halts and marks the step failed when prepare() throws, without touching later steps", async () => {
    const registry = new StrategyStepRegistry();
    registry.register(
      fakeDefinition("swap", "soroswap", {
        prepare: async () => {
          throw new Error("simulation rejected");
        },
      })
    );
    registry.register(fakeDefinition("vaultDeposit", "defindex"));
    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
      step({
        id: "b",
        type: "vaultDeposit",
        protocol: "defindex",
        dependsOn: ["a"],
      }),
    ]);

    const result = await new ExecutionEngine({
      ...baseDeps(),
      registry,
    }).executeStrategy({
      strategy,
      execution: freshRecord(strategy),
      userAddress: "GUSER",
      networkPassphrase: "p",
    });
    expect(result.status).toBe("failed");
    expect(result.record.steps).toEqual([
      expect.objectContaining({
        stepId: "a",
        status: "failed",
        errorMessage: expect.stringContaining("simulation rejected"),
      }),
    ]);
  });

  it("resuming a partially-completed execution skips already-completed steps and seeds their outputs", async () => {
    const registry = new StrategyStepRegistry();
    const prepareSpyA = vi.fn(async () => ({
      xdr: "X",
      networkPassphrase: "p",
    }));
    registry.register(
      fakeDefinition("swap", "soroswap", { prepare: prepareSpyA })
    );
    let receivedParams: unknown;
    registry.register(
      fakeDefinition("vaultDeposit", "defindex", {
        prepare: async (ctx) => {
          receivedParams = ctx.resolvedParams;
          return { xdr: "X", networkPassphrase: "p" };
        },
      })
    );

    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
      step({
        id: "b",
        type: "vaultDeposit",
        protocol: "defindex",
        dependsOn: ["a"],
        params: {
          amount: { source: "stepOutput", stepId: "a", portId: "out.amount" },
        },
      }),
    ]);
    const partialRecord = freshRecord(strategy);
    partialRecord.steps = [
      {
        stepId: "a",
        status: "completed",
        actualOutputs: { "out.amount": "99" },
      },
    ];

    const result = await new ExecutionEngine({
      ...baseDeps(),
      registry,
    }).executeStrategy({
      strategy,
      execution: partialRecord,
      userAddress: "GUSER",
      networkPassphrase: "p",
    });
    expect(result.status).toBe("completed");
    expect(prepareSpyA).not.toHaveBeenCalled();
    expect(receivedParams).toEqual({ amount: "99" });
  });

  it("calls onStepUpdate after every status transition, in order", async () => {
    const registry = new StrategyStepRegistry();
    registry.register(fakeDefinition("swap", "soroswap"));
    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
    ]);
    const statuses: string[] = [];

    await new ExecutionEngine({ ...baseDeps(), registry }).executeStrategy({
      strategy,
      execution: freshRecord(strategy),
      userAddress: "GUSER",
      networkPassphrase: "p",
      onStepUpdate: (record) => {
        const s = record.steps.find((st) => st.stepId === "a");
        if (s) statuses.push(s.status);
      },
    });

    // The final onStepUpdate call reflects overall record completion, re-reporting the
    // already-"completed" step status once more — dedupe consecutive repeats.
    const distinct = statuses.filter((s, i) => s !== statuses[i - 1]);
    expect(distinct).toEqual([
      "preparing",
      "awaiting_signature",
      "submitting",
      "confirming",
      "completed",
    ]);
  });
});

// ─── Recovery ────────────────────────────────────────────────────────────────

const WALLET = "GALICE";
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

beforeEach(() => {
  window.localStorage.clear();
});

describe("reconcileExecution", () => {
  it("marks a submitting/confirming step completed or failed per the chain status, without mutating the original record", async () => {
    const successRecord = execution("e1", {
      steps: [{ stepId: "a", status: "submitting", txHash: "H1" }],
    });
    const getSuccess = vi.fn().mockResolvedValue("SUCCESS");
    const reconciledSuccess = await reconcileExecution(successRecord, {
      getTransactionStatus: getSuccess,
    });
    expect(getSuccess).toHaveBeenCalledWith("H1");
    expect(reconciledSuccess.steps[0].status).toBe("completed");
    expect(reconciledSuccess.steps[0].confirmedAt).toBeDefined();
    expect(successRecord.steps[0].status).toBe("submitting"); // original untouched

    const failedRecord = execution("e2", {
      steps: [{ stepId: "a", status: "confirming", txHash: "H1" }],
    });
    const reconciledFailed = await reconcileExecution(failedRecord, {
      getTransactionStatus: vi.fn().mockResolvedValue("FAILED"),
    });
    expect(reconciledFailed.steps[0].status).toBe("failed");
    expect(reconciledFailed.steps[0].errorMessage).toBeDefined();
  });

  it("leaves the status untouched on PENDING or a reconciliation poll error, and skips completed/never-submitted steps", async () => {
    const pendingRecord = execution("e1", {
      steps: [{ stepId: "a", status: "submitting", txHash: "H1" }],
    });
    expect(
      (
        await reconcileExecution(pendingRecord, {
          getTransactionStatus: vi.fn().mockResolvedValue("PENDING"),
        })
      ).steps[0].status
    ).toBe("submitting");

    const erroringRecord = execution("e2", {
      steps: [{ stepId: "a", status: "confirming", txHash: "H1" }],
    });
    expect(
      (
        await reconcileExecution(erroringRecord, {
          getTransactionStatus: vi
            .fn()
            .mockRejectedValue(new Error("network down")),
        })
      ).steps[0].status
    ).toBe("confirming");

    const getStatus = vi.fn();
    await reconcileExecution(
      execution("e3", {
        steps: [
          { stepId: "a", status: "completed", txHash: "H1" },
          { stepId: "b", status: "pending" },
        ],
      }),
      { getTransactionStatus: getStatus }
    );
    expect(getStatus).not.toHaveBeenCalled();
  });
});

describe("findResumableExecutions", () => {
  it("surfaces in_progress and paused-deviation executions for the resume prompt", () => {
    upsertExecution(WALLET, execution("done", { status: "completed" }));
    upsertExecution(WALLET, execution("running", { status: "in_progress" }));
    upsertExecution(
      WALLET,
      execution("paused", { status: "paused-deviation" })
    );
    expect(
      findResumableExecutions(WALLET)
        .map((e) => e.id)
        .sort()
    ).toEqual(["paused", "running"]);
  });
});
