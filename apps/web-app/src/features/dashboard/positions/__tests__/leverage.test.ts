import { describe, expect, it } from "vitest";
import { computeLeveragePositionSummary } from "../leverage";
import { normalizeLeveragePositions } from "../normalize";
import type { LeverageLoopStrategyMeta } from "@/lib/strategy/leverage/types";
import type { PriceLookup } from "../normalize";

function makeMeta(
  overrides: Partial<LeverageLoopStrategyMeta> = {}
): LeverageLoopStrategyMeta {
  return {
    kind: "leverage-loop",
    assetCode: "USTRY",
    borrowAssetCode: "USDC",
    targetMultiple: 1.7,
    achievedMultiple: 1.69,
    safetyBufferPct: 5,
    route: {
      poolsUsed: [
        {
          poolType: "blend",
          collateralPoolId: "blend:CPOOL:CUSTRY",
          borrowPoolId: "blend:CPOOL:CUSDC",
          maxLtvPct: 75,
          borrowRatePct: 4,
          availableLiquidity: "1000",
        },
      ],
      iterations: [
        {
          index: 1,
          poolType: "blend",
          collateralPoolId: "blend:CPOOL:CUSTRY",
          borrowPoolId: "blend:CPOOL:CUSDC",
          depositAmount: "100",
          borrowAmount: "70",
          swapAmountOut: "69",
          swapPriceImpactBps: 100,
        },
      ],
    },
    ...overrides,
  };
}

const priceOf =
  (prices: Record<string, number>): PriceLookup =>
  (code) =>
    code in prices ? prices[code] : null;

describe("computeLeveragePositionSummary", () => {
  it("reduces a single-iteration loop's collateral/debt into HF, liquidation price, and effective leverage", () => {
    const summary = computeLeveragePositionSummary(
      "strat-1",
      "USTRY 1.7x",
      makeMeta(),
      priceOf({ USTRY: 10, USDC: 1 })
    );

    // total collateral = initial deposit (100) + final redeposit (69) = 169
    expect(summary.totalCollateralUnits).toBeCloseTo(169, 6);
    expect(summary.totalDebtUnits).toBeCloseTo(70, 6);
    expect(summary.blendedCollateralFactorPct).toBeCloseTo(75, 6);
    expect(summary.blendedEntryPrice).toBeCloseTo(10 * 1.01, 6);
    expect(summary.collateralValueUsd).toBeCloseTo(1690, 6);
    expect(summary.debtValueUsd).toBeCloseTo(70, 6);
    expect(summary.effectiveLeverage).toBeCloseTo(1690 / 1620, 6);
    expect(summary.healthFactor).toBeCloseTo((1690 * 0.75) / 70, 6);
    expect(summary.liquidationPrice).toBeCloseTo(70 / (169 * 0.75), 6);
  });

  it("blends collateral factor across multiple pools weighted by each pool's share of total debt", () => {
    const meta = makeMeta({
      route: {
        poolsUsed: [
          {
            poolType: "blend",
            collateralPoolId: "blend:CPOOL:CUSTRY",
            borrowPoolId: "blend:CPOOL:CUSDC",
            maxLtvPct: 80,
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
            collateralPoolId: "blend:CPOOL:CUSTRY",
            borrowPoolId: "blend:CPOOL:CUSDC",
            depositAmount: "100",
            borrowAmount: "80", // weight 80
            swapAmountOut: "80",
            swapPriceImpactBps: 0,
          },
          {
            index: 2,
            poolType: "neko",
            collateralPoolId: "neko:USTRY",
            borrowPoolId: "neko:USDC",
            depositAmount: "80",
            borrowAmount: "20", // weight 20
            swapAmountOut: "20",
            swapPriceImpactBps: 0,
          },
        ],
      },
    });

    const summary = computeLeveragePositionSummary(
      "strat-2",
      "USTRY multi-pool",
      meta,
      priceOf({ USTRY: 1, USDC: 1 })
    );

    // weighted: (80*80 + 20*70) / 100 = 78
    expect(summary.blendedCollateralFactorPct).toBeCloseTo(78, 6);
  });

  it("returns null risk figures (but keeps unit totals and entry price) when the debt asset has no price", () => {
    const summary = computeLeveragePositionSummary(
      "strat-3",
      "USTRY no debt price",
      makeMeta(),
      priceOf({ USTRY: 10 })
    );

    expect(summary.totalCollateralUnits).toBeCloseTo(169, 6);
    expect(summary.blendedEntryPrice).not.toBeNull();
    expect(summary.debtValueUsd).toBeNull();
    expect(summary.healthFactor).toBeNull();
    expect(summary.liquidationPrice).toBeNull();
    expect(summary.effectiveLeverage).toBeNull();
  });

  it("handles a strategy with zero iterations without crashing", () => {
    const meta = makeMeta({ route: { poolsUsed: [], iterations: [] } });
    const summary = computeLeveragePositionSummary(
      "strat-4",
      "Empty",
      meta,
      priceOf({ USTRY: 10, USDC: 1 })
    );
    expect(summary.totalCollateralUnits).toBe(0);
    expect(summary.totalDebtUnits).toBe(0);
  });
});

describe("normalizeLeveragePositions", () => {
  it("emits a collateral asset row and a debt liability row per position", () => {
    const summary = computeLeveragePositionSummary(
      "strat-1",
      "USTRY 1.7x",
      makeMeta(),
      priceOf({ USTRY: 10, USDC: 1 })
    );
    const rows = normalizeLeveragePositions([summary]);
    expect(rows).toHaveLength(2);
    expect(rows[0].direction).toBe("asset");
    expect(rows[0].protocol).toBe("leverage");
    expect(rows[1].direction).toBe("liability");
  });

  it("omits the debt row when there is no outstanding debt", () => {
    const meta = makeMeta({
      route: {
        poolsUsed: [],
        iterations: [],
      },
    });
    const summary = computeLeveragePositionSummary(
      "strat-5",
      "No debt",
      meta,
      priceOf({ USTRY: 10, USDC: 1 })
    );
    const rows = normalizeLeveragePositions([summary]);
    expect(rows).toHaveLength(1);
    expect(rows[0].direction).toBe("asset");
  });
});
