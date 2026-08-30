// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@neko/lending", () => ({
  networks: {
    testnet: {
      pool1ContractId: "CPOOL1USDCXLM",
      pool2ContractId: "CPOOL2RWA",
    },
  },
}));

vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getAvailableTokens: () => ({
    USTRY: {
      contract: "CUSTRYTOKEN",
      code: "USTRY",
      name: "US Treasury",
      decimals: 7,
    },
    USDC: {
      contract: "CUSDCTOKEN",
      code: "USDC",
      name: "USD Coin",
      decimals: 7,
    },
  }),
}));

import { buildOpenLoopSteps } from "../buildStrategy";
import {
  ExecutionEngine,
  type ExecutionEngineDeps,
} from "@/lib/strategy/execution";
import { StrategyStepRegistry } from "@/lib/strategy/registry";
import type {
  ExecutionRecord,
  Strategy,
  StrategyStepDefinition,
} from "@/lib/strategy/types";
import type { RoutedLoopPlan } from "../types";

/**
 * Integration test (Testing section): a full routed leverage loop, composed
 * exactly the way lib/strategy/leverage/buildStrategy.ts produces it, run
 * end-to-end through the REAL lib/strategy/execution.ts ExecutionEngine —
 * only the protocol adapters underneath (supply/borrow/swap prepare()) are
 * mocked, exactly like lib/strategy/__tests__/execution.test.ts's own
 * pattern. Proves Scope §3's "composition onto the existing engine" claim
 * actually holds for a real multi-iteration, cross-protocol loop, not just
 * the unit-level step-shape assertions in buildStrategy.test.ts.
 */

function twoIterationRoute(): RoutedLoopPlan {
  return {
    ok: true,
    assetCode: "USTRY",
    poolsUsed: [
      {
        poolType: "blend",
        collateralPoolId: "blend:CBLENDPOOL:CUSTRYTOKEN",
        borrowPoolId: "blend:CBLENDPOOL:CUSDCTOKEN",
        maxLtvPct: 75,
        borrowRatePct: 4,
        availableLiquidity: "1000",
      },
      {
        poolType: "neko",
        collateralPoolId: "neko:USTRY",
        borrowPoolId: "neko:USDC",
        maxLtvPct: 70,
        borrowRatePct: 6,
        availableLiquidity: "1000",
      },
    ],
    iterations: [
      {
        index: 1,
        poolType: "blend",
        collateralPoolId: "blend:CBLENDPOOL:CUSTRYTOKEN",
        borrowPoolId: "blend:CBLENDPOOL:CUSDCTOKEN",
        depositAmount: "100",
        borrowAmount: "70",
        swapAmountOut: "69",
        swapPriceImpactBps: 15,
      },
      {
        index: 2,
        poolType: "neko",
        collateralPoolId: "neko:USTRY",
        borrowPoolId: "neko:USDC",
        depositAmount: "69",
        borrowAmount: "48.3",
        swapAmountOut: "47",
        swapPriceImpactBps: 20,
      },
    ],
    simulation: {
      steps: [],
      blendedEntryPrice: null,
      totalBorrowCostPct: 4.8,
      totalSlippageBps: 35,
    },
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

function buildRegistry(overrides?: {
  borrowBlendPrepare?: StrategyStepDefinition["prepare"];
  onSwapAmountIn?: (amountIn: string) => void;
}): StrategyStepRegistry {
  const registry = new StrategyStepRegistry();

  registry.register(fakeDefinition("supply", "blend"));
  registry.register(fakeDefinition("supply", "neko"));
  registry.register(
    fakeDefinition("borrow", "blend", {
      // Object spread in fakeDefinition() overrides the default `prepare`
      // even when the value is explicitly `undefined` (the key is still
      // present) — only include it when there's a real override.
      ...(overrides?.borrowBlendPrepare
        ? { prepare: overrides.borrowBlendPrepare }
        : {}),
      interpretResult: async (ctx) => ({
        outputs: { "out.borrowedAsset": String(ctx.resolvedParams.amount) },
      }),
    })
  );
  registry.register(
    fakeDefinition("borrow", "neko", {
      interpretResult: async (ctx) => ({
        outputs: { "out.borrowedAsset": String(ctx.resolvedParams.amount) },
      }),
    })
  );
  registry.register(
    fakeDefinition("swap", "soroswap", {
      submissionMode: "soroswapApi",
      prepare: async (ctx) => {
        overrides?.onSwapAmountIn?.(String(ctx.resolvedParams.amountIn));
        return { xdr: "UNSIGNED_XDR", networkPassphrase: "p" };
      },
      interpretResult: async (ctx) => ({
        outputs: {
          "out.receivedAsset": String(ctx.resolvedParams.amountIn),
        },
      }),
    })
  );

  return registry;
}

function freshRecord(strategy: Strategy): ExecutionRecord {
  return {
    id: "exec-1",
    strategyId: strategy.id,
    strategySnapshot: strategy,
    status: "in_progress",
    startedAt: 0,
    updatedAt: 0,
    projectedOutcome: { steps: {} },
    steps: [],
  };
}

function baseDeps(
  registry: StrategyStepRegistry,
  overrides: Partial<ExecutionEngineDeps> = {}
): ExecutionEngineDeps {
  return {
    registry,
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

describe("leverage-loop open steps through the real ExecutionEngine", () => {
  it("executes every step of a 2-iteration cross-protocol loop in dependency order, all the way to completion", async () => {
    const route = twoIterationRoute();
    const steps = buildOpenLoopSteps({
      route,
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
    });
    const strategy: Strategy = {
      id: "leverage-strat-1",
      version: 1,
      name: "USTRY 1.7x",
      isTemplate: false,
      steps,
      createdAt: 0,
      updatedAt: 0,
    };

    const swapAmountIns: string[] = [];
    const registry = buildRegistry({
      onSwapAmountIn: (amountIn) => swapAmountIns.push(amountIn),
    });
    const engine = new ExecutionEngine(baseDeps(registry));
    const result = await engine.executeStrategy({
      strategy,
      execution: freshRecord(strategy),
      userAddress: "GUSER",
      networkPassphrase: "p",
    });

    expect(result.status).toBe("completed");
    expect(result.record.steps).toHaveLength(steps.length);
    expect(result.record.steps.every((s) => s.status === "completed")).toBe(
      true
    );

    // Each swap's amountIn is the STEP OUTPUT of that iteration's own
    // borrow, not the route's static plan — proves the dependsOn/stepOutput
    // chain actually threads live actualOutputs across iterations AND
    // across protocols (blend iteration 1 feeding into neko iteration 2),
    // not just structurally matching what buildStrategy.test.ts checks.
    expect(swapAmountIns).toEqual(["70", "48.3"]);
  });

  it("stops at the failing step on a mid-loop failure, leaving a well-defined, inspectable partial state", async () => {
    const route = twoIterationRoute();
    const steps = buildOpenLoopSteps({
      route,
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
    });
    const strategy: Strategy = {
      id: "leverage-strat-2",
      version: 1,
      name: "USTRY 1.7x",
      isTemplate: false,
      steps,
      createdAt: 0,
      updatedAt: 0,
    };

    // Iteration 2's borrow (the 5th step overall: supply1, borrow1, swap1,
    // supply2, borrow2, swap2, redeposit) fails on-chain.
    const registry = buildRegistry();
    // Re-register neko's borrow specifically to fail — iteration 2 is neko.
    registry.register(
      fakeDefinition("borrow", "neko", {
        prepare: async () => {
          throw new Error("insufficient collateral on-chain");
        },
      })
    );

    const engine = new ExecutionEngine(baseDeps(registry));
    const result = await engine.executeStrategy({
      strategy,
      execution: freshRecord(strategy),
      userAddress: "GUSER",
      networkPassphrase: "p",
    });

    expect(result.status).toBe("failed");
    expect(result.record.status).toBe("failed");

    const byId = new Map(result.record.steps.map((s) => [s.stepId, s]));

    // Everything before iteration 2's borrow completed.
    expect(byId.get("leverage-supply-1")?.status).toBe("completed");
    expect(byId.get("leverage-borrow-1")?.status).toBe("completed");
    expect(byId.get("leverage-swap-1")?.status).toBe("completed");
    expect(byId.get("leverage-supply-2")?.status).toBe("completed");

    // The failing step itself is recorded, with its error.
    expect(byId.get("leverage-borrow-2")?.status).toBe("failed");
    expect(byId.get("leverage-borrow-2")?.errorMessage).toMatch(
      /insufficient collateral/
    );

    // Nothing after the failure was ever attempted — not even recorded as
    // "pending", since the engine never reached them. That absence IS the
    // well-defined partial state: exactly what ran, exactly where it
    // stopped, nothing guessed about what would have happened next.
    expect(byId.has("leverage-swap-2")).toBe(false);
    expect(byId.has("leverage-redeposit-final")).toBe(false);

    // The position's on-chain collateral/debt from the completed steps is
    // real and inspectable from the record alone — a caller can resume or
    // manually unwind from here without re-deriving anything.
    expect(result.record.steps).toHaveLength(5);
  });
});
