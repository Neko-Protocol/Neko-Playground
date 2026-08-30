import { describe, expect, it, vi } from "vitest";

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

import {
  buildLeverageStrategy,
  buildOpenLoopSteps,
  buildUnwindTranches,
} from "../buildStrategy";
import type { RoutedLoopPlan } from "../types";

function makeRoute(): RoutedLoopPlan {
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
      totalBorrowCostPct: 4.5,
      totalSlippageBps: 35,
    },
  };
}

describe("buildOpenLoopSteps", () => {
  it("chains supply -> borrow -> swap per iteration, plus a final redeposit, via dependsOn and stepOutput bindings", () => {
    const route = makeRoute();
    const steps = buildOpenLoopSteps({
      route,
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
    });

    // 3 steps per iteration (supply, borrow, swap) x 2 iterations + 1 final redeposit.
    expect(steps).toHaveLength(7);

    const byId = new Map(steps.map((s) => [s.id, s]));
    const supply1 = byId.get("leverage-supply-1")!;
    expect(supply1.dependsOn).toEqual([]);
    expect(supply1.params.amount).toEqual({ source: "literal", value: "100" });
    expect(supply1.protocol).toBe("blend");
    expect(supply1.params.poolContractId).toEqual({
      source: "literal",
      value: "CBLENDPOOL",
    });

    const borrow1 = byId.get("leverage-borrow-1")!;
    expect(borrow1.dependsOn).toEqual(["leverage-supply-1"]);
    expect(borrow1.params.amount).toEqual({ source: "literal", value: "70" });

    const swap1 = byId.get("leverage-swap-1")!;
    expect(swap1.dependsOn).toEqual(["leverage-borrow-1"]);
    expect(swap1.params.amountIn).toEqual({
      source: "stepOutput",
      stepId: "leverage-borrow-1",
      portId: "out.borrowedAsset",
    });

    const supply2 = byId.get("leverage-supply-2")!;
    expect(supply2.dependsOn).toEqual(["leverage-swap-1"]);
    expect(supply2.protocol).toBe("neko");
    expect(supply2.params.amount).toEqual({
      source: "stepOutput",
      stepId: "leverage-swap-1",
      portId: "out.receivedAsset",
    });
    // Neko collateral resolves through the fixed pool2 contract + token address.
    expect(supply2.params.poolContractId).toEqual({
      source: "literal",
      value: "CPOOL2RWA",
    });
    expect(supply2.params.collateralTokenAddress).toEqual({
      source: "literal",
      value: "CUSTRYTOKEN",
    });

    const borrow2 = byId.get("leverage-borrow-2")!;
    // Neko borrow only needs assetCode — pool1 resolution is internal to the adapter.
    expect(borrow2.params).toEqual({
      assetCode: { source: "literal", value: "USDC" },
      amount: { source: "literal", value: "48.3" },
    });

    const final = byId.get("leverage-redeposit-final")!;
    expect(final.dependsOn).toEqual(["leverage-swap-2"]);
    expect(final.params.amount).toEqual({
      source: "stepOutput",
      stepId: "leverage-swap-2",
      portId: "out.receivedAsset",
    });
  });
});

describe("buildLeverageStrategy", () => {
  it("attaches leverageMeta with the kind discriminator, target/achieved multiple, buffer, and route", () => {
    const route = makeRoute();
    const strategy = buildLeverageStrategy(
      {
        route,
        assetCode: "USTRY",
        borrowAssetCode: "USDC",
        initialCollateralAmount: "100",
      },
      2,
      2.02,
      5
    );

    expect(strategy.leverageMeta).toEqual({
      kind: "leverage-loop",
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      targetMultiple: 2,
      achievedMultiple: 2.02,
      safetyBufferPct: 5,
      route: { poolsUsed: route.poolsUsed, iterations: route.iterations },
    });
    expect(strategy.isTemplate).toBe(false);
    expect(strategy.steps.length).toBeGreaterThan(0);
  });
});

describe("buildUnwindTranches", () => {
  it("orders tranches newest-iteration-first, each independently self-contained and repay-before-withdraw", () => {
    const route = makeRoute();
    const tranches = buildUnwindTranches({
      route,
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
    });

    // One tranche per iteration — no tranche for the debt-free final
    // redeposit, since withdrawing it without a matching repay would only
    // ever worsen health factor.
    expect(tranches).toHaveLength(2);
    expect(tranches.map((t) => t.order)).toEqual([0, 1]);

    // order 0: iteration 2 unwound first (newest first).
    expect(tranches[0].debtAmount).toBe("48.3");
    expect(tranches[0].steps).toHaveLength(2);
    expect(tranches[0].steps[0].type).toBe("repay");
    expect(tranches[0].steps[0].dependsOn).toEqual([]);
    expect(tranches[0].steps[1].type).toBe("supply");
    expect(tranches[0].steps[1].params.direction).toEqual({
      source: "literal",
      value: "withdraw",
    });
    expect(tranches[0].steps[1].dependsOn).toEqual([tranches[0].steps[0].id]);

    // order 1: iteration 1 unwound last.
    expect(tranches[1].debtAmount).toBe("70");

    // Every step across every tranche only binds literal values — no
    // stepOutput bindings crossing tranche boundaries, since each tranche
    // must be independently pre-signable and submittable.
    for (const tranche of tranches) {
      for (const step of tranche.steps) {
        for (const binding of Object.values(step.params)) {
          expect(binding.source).toBe("literal");
        }
      }
    }
  });
});
