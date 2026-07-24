import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  topologicalSort,
  validateStrategy,
  validateBalances,
  simulateStrategy,
  aggregateProjection,
  computeSensitivity,
  DEFAULT_SENSITIVITY_SCENARIOS,
  evaluateRisk,
  computeProtocolExposure,
  DEFAULT_RISK_THRESHOLDS,
  exceedsThresholds,
  deviationThresholdFor,
} from "../engine";
import { StrategyStepRegistry } from "../registry";
import type {
  ResultingPosition,
  RiskAssessment,
  Strategy,
  StrategyStep,
  StrategyStepDefinition,
  StepExecutionContext,
  StepProjection,
  StrategyProjection,
  ValidationIssue,
} from "../types";

function step(
  overrides: Partial<StrategyStep> & {
    id: string;
    type?: string;
    protocol?: string;
  }
): StrategyStep {
  return {
    type: "swap",
    protocol: "soroswap",
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

// ─── Cycle detection ─────────────────────────────────────────────────────────

describe("topologicalSort", () => {
  it("orders a linear chain respecting dependencies", () => {
    const result = topologicalSort([
      step({ id: "a" }),
      step({ id: "b", dependsOn: ["a"] }),
      step({ id: "c", dependsOn: ["b"] }),
    ]);
    expect(result.issues).toEqual([]);
    expect(result.order).toEqual(["a", "b", "c"]);
  });

  it("orders a diamond graph respecting both branches before the merge step", () => {
    const result = topologicalSort([
      step({ id: "a" }),
      step({ id: "b", dependsOn: ["a"] }),
      step({ id: "c", dependsOn: ["a"] }),
      step({ id: "d", dependsOn: ["b", "c"] }),
    ]);
    const order = result.order!;
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
  });

  it("orders disconnected components independently, preserving original order for ties", () => {
    expect(
      topologicalSort([
        step({ id: "a" }),
        step({ id: "b" }),
        step({ id: "c", dependsOn: ["a"] }),
      ]).order
    ).toEqual(["a", "b", "c"]);
  });

  it("detects a self-loop and a multi-node cycle as circular dependencies", () => {
    const selfLoop = topologicalSort([step({ id: "a", dependsOn: ["a"] })]);
    expect(selfLoop.order).toBeNull();
    expect(selfLoop.issues[0]).toMatchObject({
      severity: "error",
      code: "CIRCULAR_DEPENDENCY",
      stepId: "a",
    });

    const cycle = topologicalSort([
      step({ id: "a", dependsOn: ["c"] }),
      step({ id: "b", dependsOn: ["a"] }),
      step({ id: "c", dependsOn: ["b"] }),
    ]);
    expect(cycle.order).toBeNull();
    expect(cycle.issues[0].message).toContain("a");
    expect(cycle.issues[0].message).toContain("b");
    expect(cycle.issues[0].message).toContain("c");
  });

  it("silently ignores a dangling dependsOn reference and handles an empty strategy", () => {
    expect(topologicalSort([step({ id: "a", dependsOn: ["ghost"] })])).toEqual({
      order: ["a"],
      issues: [],
    });
    expect(topologicalSort([])).toEqual({ order: [], issues: [] });
  });
});

// ─── Validation ──────────────────────────────────────────────────────────────

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
    describeOutputs: () => [
      { id: "out.amount", assetCode: "USDC", kind: "asset" },
    ],
    validate: () => [],
    simulate: async () => ({ outputs: {}, estimatedFee: "0", warnings: [] }),
    prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    ...overrides,
  };
}

function registryWith(
  ...definitions: StrategyStepDefinition[]
): StrategyStepRegistry {
  const registry = new StrategyStepRegistry();
  for (const d of definitions) registry.register(d);
  return registry;
}

describe("validateStrategy", () => {
  it("passes a valid two-step chain with a declared, bound dependency", () => {
    const registry = registryWith(
      fakeDefinition("swap", "soroswap"),
      fakeDefinition("vaultDeposit", "defindex")
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
    const result = validateStrategy(strategy, { registry });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("flags dependency structure errors: unknown/forward reference, undeclared binding, incompatible port", () => {
    const registry = registryWith(
      fakeDefinition("swap", "soroswap"),
      fakeDefinition("vaultDeposit", "defindex")
    );

    expect(
      validateStrategy(
        strategyWith([step({ id: "a", dependsOn: ["ghost"] })]),
        { registry }
      ).issues
    ).toContainEqual(
      expect.objectContaining({ stepId: "a", code: "INVALID_DEPENDENCY" })
    );

    expect(
      validateStrategy(
        strategyWith([step({ id: "a", dependsOn: ["b"] }), step({ id: "b" })]),
        { registry }
      ).issues
    ).toContainEqual(
      expect.objectContaining({ stepId: "a", code: "INVALID_DEPENDENCY" })
    );

    expect(
      validateStrategy(
        strategyWith([
          step({ id: "a", type: "swap", protocol: "soroswap" }),
          step({
            id: "b",
            type: "vaultDeposit",
            protocol: "defindex",
            params: {
              amount: {
                source: "stepOutput",
                stepId: "a",
                portId: "out.amount",
              },
            },
          }),
        ]),
        { registry }
      ).issues
    ).toContainEqual(
      expect.objectContaining({ stepId: "b", code: "UNDECLARED_DEPENDENCY" })
    );

    expect(
      validateStrategy(
        strategyWith([
          step({ id: "a", type: "swap", protocol: "soroswap" }),
          step({
            id: "b",
            type: "vaultDeposit",
            protocol: "defindex",
            dependsOn: ["a"],
            params: {
              amount: {
                source: "stepOutput",
                stepId: "a",
                portId: "out.nonexistent",
              },
            },
          }),
        ]),
        { registry }
      ).issues
    ).toContainEqual(
      expect.objectContaining({ stepId: "b", code: "INCOMPATIBLE_ASSET" })
    );
  });

  it("detects a circular dependency and reports it as an issue, not a crash", () => {
    const registry = registryWith(fakeDefinition("swap", "soroswap"));
    const result = validateStrategy(
      strategyWith([
        step({ id: "a", dependsOn: ["b"] }),
        step({ id: "b", dependsOn: ["a"] }),
      ]),
      { registry }
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "CIRCULAR_DEPENDENCY")).toBe(
      true
    );
  });

  it("flags an unregistered step type and surfaces a definition-level issue at the failing step", () => {
    expect(
      validateStrategy(
        strategyWith([
          step({ id: "a", type: "lpRemove", protocol: "soroswap" }),
        ]),
        { registry: registryWith() }
      ).issues
    ).toContainEqual(
      expect.objectContaining({ stepId: "a", code: "UNSUPPORTED_STEP" })
    );

    const alwaysFails: ValidationIssue[] = [
      {
        stepId: null,
        severity: "error",
        code: "UNSUPPORTED_PROTOCOL_COMBINATION",
        message: "not supported",
      },
    ];
    const registry = registryWith(
      fakeDefinition("lpRemove", "soroswap", { validate: () => alwaysFails })
    );
    expect(
      validateStrategy(
        strategyWith([
          step({ id: "a", type: "lpRemove", protocol: "soroswap" }),
        ]),
        { registry }
      ).issues
    ).toContainEqual(
      expect.objectContaining({
        stepId: "a",
        code: "UNSUPPORTED_PROTOCOL_COMBINATION",
      })
    );
  });

  it("never throws even when a definition's validate() throws", () => {
    const registry = registryWith(
      fakeDefinition("swap", "soroswap", {
        validate: () => {
          throw new Error("boom");
        },
      })
    );
    const strategy = strategyWith([
      step({ id: "a", type: "swap", protocol: "soroswap" }),
    ]);
    expect(() => validateStrategy(strategy, { registry })).not.toThrow();
    expect(validateStrategy(strategy, { registry }).issues).toContainEqual(
      expect.objectContaining({ stepId: "a", code: "VALIDATION_ERROR" })
    );
  });

  it("includes balance issues only when a balances map is provided", () => {
    const registry = registryWith(fakeDefinition("swap", "soroswap"));
    const strategy = strategyWith([
      step({
        id: "a",
        type: "swap",
        protocol: "soroswap",
        params: {
          tokenIn: { source: "literal", value: "USDC" },
          amountIn: { source: "literal", value: "1000" },
        },
      }),
    ]);
    expect(
      validateStrategy(strategy, { registry, balances: { USDC: "1" } }).issues
    ).toContainEqual(expect.objectContaining({ code: "INSUFFICIENT_BALANCE" }));
    expect(validateStrategy(strategy, { registry }).issues).toEqual([]);
  });
});

describe("validateBalances", () => {
  it("flags a root step whose literal amount exceeds the wallet balance", () => {
    const strategy = strategyWith([
      step({
        id: "a",
        params: {
          tokenIn: { source: "literal", value: "USDC" },
          amountIn: { source: "literal", value: "100" },
        },
      }),
    ]);
    expect(validateBalances(strategy, { USDC: "50" })).toEqual([
      expect.objectContaining({ stepId: "a", code: "INSUFFICIENT_BALANCE" }),
    ]);
  });

  it("passes with enough balance, skips upstream-funded and unknown-asset steps", () => {
    expect(
      validateBalances(
        strategyWith([
          step({
            id: "a",
            params: {
              assetCode: { source: "literal", value: "USDC" },
              amount: { source: "literal", value: "50" },
            },
          }),
        ]),
        { USDC: "100" }
      )
    ).toEqual([]);
    expect(
      validateBalances(
        strategyWith([
          step({
            id: "a",
            dependsOn: ["x"],
            params: {
              assetCode: { source: "literal", value: "USDC" },
              amount: { source: "literal", value: "999999" },
            },
          }),
        ]),
        { USDC: "1" }
      )
    ).toEqual([]);
    expect(
      validateBalances(
        strategyWith([
          step({
            id: "a",
            params: {
              assetCode: { source: "literal", value: "USDC" },
              amount: {
                source: "stepOutput",
                stepId: "x",
                portId: "out.amount",
              },
            },
          }),
        ]),
        { USDC: "0" }
      )
    ).toEqual([]);
  });
});

// ─── Simulation ──────────────────────────────────────────────────────────────

const execCtx = { userAddress: "GUSER", networkPassphrase: "p" };

describe("simulateStrategy", () => {
  it("feeds step A's simulate() output forward as step B's resolvedParams and aggregates fees bigint-safely", async () => {
    const registry = new StrategyStepRegistry();
    registry.register({
      stepType: "swap",
      protocol: "soroswap",
      submissionMode: "soroswapApi",
      paramsSchema: z.object({}).passthrough(),
      describeOutputs: () => [
        { id: "out.amount", assetCode: "USDC", kind: "asset" },
      ],
      validate: () => [],
      simulate: async () => ({
        outputs: { "out.amount": "42" },
        estimatedFee: "0.0000001",
        slippageBps: 10,
        warnings: [],
      }),
      prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    });
    let received: unknown;
    registry.register({
      stepType: "vaultDeposit",
      protocol: "defindex",
      submissionMode: "rpc",
      paramsSchema: z.object({}).passthrough(),
      describeOutputs: () => [],
      validate: () => [],
      simulate: async (ctx: StepExecutionContext) => {
        received = ctx.resolvedParams;
        return { outputs: {}, estimatedFee: "0.0000002", warnings: [] };
      },
      prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    });

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
    const projection = await simulateStrategy(strategy, {
      ...execCtx,
      registry,
    });
    expect(projection.success).toBe(true);
    expect(received).toEqual({ amount: "42" });
    expect(projection.cumulativeFee).toBe("0.0000003");
  });

  it("reports the exact blocking step on failure and never partially succeeds", async () => {
    const registry = new StrategyStepRegistry();
    registry.register({
      stepType: "swap",
      protocol: "soroswap",
      submissionMode: "soroswapApi",
      paramsSchema: z.object({}).passthrough(),
      describeOutputs: () => [],
      validate: () => [],
      simulate: async () => {
        throw new Error("No liquidity found");
      },
      prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    });
    registry.register({
      stepType: "vaultDeposit",
      protocol: "defindex",
      submissionMode: "rpc",
      paramsSchema: z.object({}).passthrough(),
      describeOutputs: () => [],
      validate: () => [],
      simulate: async () => ({ outputs: {}, estimatedFee: "0", warnings: [] }),
      prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    });

    const strategy = strategyWith([
      step({ id: "boom-step", type: "swap", protocol: "soroswap" }),
      step({
        id: "b",
        type: "vaultDeposit",
        protocol: "defindex",
        dependsOn: ["boom-step"],
      }),
    ]);
    const projection = await simulateStrategy(strategy, {
      ...execCtx,
      registry,
    });
    expect(projection.success).toBe(false);
    expect(projection.failedStepId).toBe("boom-step");
    expect(projection.failureReason).toContain("No liquidity found");
    expect(projection.steps.b).toBeUndefined();
  });

  it("reports a circular dependency without ever calling simulate(), and an unregistered step cleanly", async () => {
    let called = false;
    const registry = new StrategyStepRegistry();
    registry.register({
      stepType: "swap",
      protocol: "soroswap",
      submissionMode: "soroswapApi",
      paramsSchema: z.object({}).passthrough(),
      describeOutputs: () => [],
      validate: () => [],
      simulate: async () => {
        called = true;
        return { outputs: {}, estimatedFee: "0", warnings: [] };
      },
      prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    });
    const cyclic = strategyWith([
      step({ id: "a", dependsOn: ["b"] }),
      step({ id: "b", dependsOn: ["a"] }),
    ]);
    const cyclicProjection = await simulateStrategy(cyclic, {
      ...execCtx,
      registry,
    });
    expect(cyclicProjection.success).toBe(false);
    expect(called).toBe(false);

    const unresolved = strategyWith([
      step({ id: "a", type: "lpRemove", protocol: "soroswap" }),
    ]);
    const unresolvedProjection = await simulateStrategy(unresolved, {
      ...execCtx,
      registry: new StrategyStepRegistry(),
    });
    expect(unresolvedProjection.success).toBe(false);
    expect(unresolvedProjection.failureReason).toContain("lpRemove:soroswap");
  });

  it("derives health factor from step resultingPosition deltas", async () => {
    const registry = new StrategyStepRegistry();
    registry.register({
      stepType: "supply",
      protocol: "neko",
      submissionMode: "rpc",
      paramsSchema: z.object({}).passthrough(),
      describeOutputs: () => [],
      validate: () => [],
      simulate: async () => ({
        outputs: {},
        estimatedFee: "0",
        warnings: [],
        resultingPosition: {
          protocol: "neko",
          collateralAssetCode: "CETES",
          collateralDelta: 100,
          collateralFactorPct: 75,
        },
      }),
      prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    });
    registry.register({
      stepType: "borrow",
      protocol: "neko",
      submissionMode: "rpc",
      paramsSchema: z.object({}).passthrough(),
      describeOutputs: () => [],
      validate: () => [],
      simulate: async () => ({
        outputs: {},
        estimatedFee: "0",
        warnings: [],
        resultingPosition: {
          protocol: "neko",
          debtAssetCode: "USDC",
          debtDelta: 50,
        },
      }),
      prepare: async () => ({ xdr: "", networkPassphrase: "" }),
    });

    const strategy = strategyWith([
      step({ id: "a", type: "supply", protocol: "neko" }),
      step({ id: "b", type: "borrow", protocol: "neko", dependsOn: ["a"] }),
    ]);
    const projection = await simulateStrategy(strategy, {
      ...execCtx,
      registry,
    });
    expect(projection.success).toBe(true);
    expect(projection.projectedHealthFactor).toBeCloseTo(1.5); // (100 * 0.75) / 50
  });
});

describe("aggregateProjection", () => {
  function proj(overrides: Partial<StepProjection> = {}): StepProjection {
    return { outputs: {}, estimatedFee: "0", warnings: [], ...overrides };
  }

  it("sums fees and slippage, averages-by-sum reported APY deltas, and zeroes out on an empty map", () => {
    expect(
      aggregateProjection({
        a: proj({ estimatedFee: "0.0000001" }),
        b: proj({ estimatedFee: "0.0000002" }),
      }).cumulativeFee
    ).toBe("0.0000003");
    expect(
      aggregateProjection({
        a: proj({ slippageBps: 30 }),
        b: proj({}),
        c: proj({ slippageBps: 20 }),
      }).cumulativeSlippageBps
    ).toBe(50);
    expect(
      aggregateProjection({
        a: proj({ projectedApyDelta: 2 }),
        b: proj({}),
        c: proj({ projectedApyDelta: 1.5 }),
      }).projectedApy
    ).toBeCloseTo(3.5);
    expect(aggregateProjection({ a: proj({}) }).projectedApy).toBeNull();
    expect(aggregateProjection({})).toEqual({
      cumulativeFee: "0",
      cumulativeSlippageBps: 0,
      projectedApy: null,
    });
  });
});

describe("computeSensitivity", () => {
  const baseline: StrategyProjection = {
    success: true,
    steps: {},
    cumulativeFee: "0.0001",
    cumulativeSlippageBps: 50,
    projectedApy: 5,
    effectiveLeverage: 2,
    projectedHealthFactor: 1.5,
    projectedLiquidationPrice: 10,
  };

  it("produces one scenario per config and scales slippage by the multiplier", () => {
    const scenarios = computeSensitivity(baseline);
    expect(scenarios).toHaveLength(DEFAULT_SENSITIVITY_SCENARIOS.length);
    const doubled = computeSensitivity(baseline, [
      { label: "2x", slippageMultiplier: 2, priceShockPct: 0 },
    ]);
    expect(doubled[0].projection.cumulativeSlippageBps).toBe(100);
  });

  it("degrades health factor and moves liquidation price under an adverse price shock, and leaves both untouched at 0% shock", () => {
    const shocked = computeSensitivity(baseline, [
      { label: "-10%", slippageMultiplier: 1, priceShockPct: -0.1 },
    ])[0].projection;
    expect(shocked.projectedHealthFactor).toBeCloseTo(1.35);
    expect(shocked.projectedLiquidationPrice).toBeCloseTo(11);

    const unshocked = computeSensitivity(baseline, [
      { label: "none", slippageMultiplier: 1, priceShockPct: 0 },
    ])[0].projection;
    expect(unshocked.projectedHealthFactor).toBe(1.5);
    expect(unshocked.projectedLiquidationPrice).toBe(10);
  });

  it("passes a failed baseline through unchanged for every scenario", () => {
    const failed: StrategyProjection = {
      success: false,
      failedStepId: "x",
      failureReason: "boom",
      steps: {},
      cumulativeFee: "0",
      cumulativeSlippageBps: 0,
      projectedApy: null,
      effectiveLeverage: null,
      projectedHealthFactor: null,
      projectedLiquidationPrice: null,
    };
    expect(
      computeSensitivity(failed).every((s) => s.projection === failed)
    ).toBe(true);
  });
});

// ─── Risk ────────────────────────────────────────────────────────────────────

describe("evaluateRisk", () => {
  it("computes health factor, liquidation price, leverage, and protocol exposure from resultingPosition deltas", () => {
    const positions: ResultingPosition[] = [
      {
        protocol: "neko",
        collateralAssetCode: "CETES",
        collateralDelta: 100,
        collateralFactorPct: 75,
      },
      { protocol: "neko", debtAssetCode: "USDC", debtDelta: 50 },
    ];
    const risk = evaluateRisk(positions, 0);
    expect(risk.projectedHealthFactor).toBeCloseTo(1.5);
    expect(risk.projectedLiquidationPrice).toBeCloseTo(0.6667, 3);
    expect(risk.riskTier).toBe("safe");
    expect(risk.protocolExposure).toEqual({ neko: 150 });
  });

  it("computes leverage, returns nulls/unknown tier with no position, and passes slippage through", () => {
    expect(
      evaluateRisk(
        [
          { protocol: "neko", collateralDelta: 200 },
          { protocol: "neko", debtDelta: 100 },
        ],
        0
      ).effectiveLeverage
    ).toBeCloseTo(2);
    const empty = evaluateRisk([], 0);
    expect(empty.effectiveLeverage).toBeNull();
    expect(empty.projectedHealthFactor).toBeNull();
    expect(empty.riskTier).toBe("unknown");
    expect(evaluateRisk([], 123).cumulativeSlippageBps).toBe(123);
  });
});

describe("computeProtocolExposure", () => {
  it("sums |collateralDelta| + |debtDelta| per protocol, omitting zero-exposure protocols", () => {
    expect(
      computeProtocolExposure([
        { protocol: "neko", collateralDelta: 100 },
        { protocol: "neko", debtDelta: 50 },
        { protocol: "blend", collateralDelta: -20 },
      ])
    ).toEqual({ neko: 150, blend: 20 });
    expect(computeProtocolExposure([{ protocol: "defindex" }])).toEqual({});
    expect(computeProtocolExposure([])).toEqual({});
  });
});

describe("exceedsThresholds / deviationThresholdFor", () => {
  function assessment(overrides: Partial<RiskAssessment> = {}): RiskAssessment {
    return {
      effectiveLeverage: 1,
      projectedHealthFactor: 2,
      projectedLiquidationPrice: null,
      cumulativeSlippageBps: 0,
      riskTier: "safe",
      protocolExposure: {},
      ...overrides,
    };
  }

  it("flags health factor, leverage, and slippage breaches; ignores null fields; respects a custom config", () => {
    expect(exceedsThresholds(assessment())).toBe(false);
    expect(exceedsThresholds(assessment({ projectedHealthFactor: 1.0 }))).toBe(
      true
    );
    expect(exceedsThresholds(assessment({ effectiveLeverage: 5 }))).toBe(true);
    expect(exceedsThresholds(assessment({ cumulativeSlippageBps: 1000 }))).toBe(
      true
    );
    expect(
      exceedsThresholds(
        assessment({ projectedHealthFactor: null, effectiveLeverage: null })
      )
    ).toBe(false);
    expect(
      exceedsThresholds(assessment({ effectiveLeverage: 1.5 }), {
        ...DEFAULT_RISK_THRESHOLDS,
        maxLeverage: 1.1,
      })
    ).toBe(true);
  });

  it("returns the per-step-type override when configured, else the default", () => {
    expect(deviationThresholdFor("swap")).toBe(
      DEFAULT_RISK_THRESHOLDS.deviationThresholds.swap
    );
    expect(deviationThresholdFor("vaultDeposit")).toBe(
      DEFAULT_RISK_THRESHOLDS.defaultDeviationThreshold
    );
  });
});
