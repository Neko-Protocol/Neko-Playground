import { describe, expect, it, vi } from "vitest";
import { deriveRouteCandidates, selectRoute } from "../routing";
import type { PoolInfo } from "@/lib/orchestrator/types/pool.types";
import type { RouteCandidatePool, SwapQuoteFn } from "../types";

function makePoolInfo(overrides: Partial<PoolInfo> = {}): PoolInfo {
  return {
    id: "blend:CPOOL1:CASSET1",
    type: "blend",
    name: "Pool",
    tokens: [
      { address: "CASSET1", code: "USTRY", name: "US Treasury", decimals: 7 },
    ],
    tvl: 10_000_0000000n,
    apy: 5,
    state: "active",
    supportedActions: ["deposit", "withdraw", "supplyCollateral", "borrow"],
    metadata: {},
    ...overrides,
  };
}

function flatQuote(priceImpactBps: number): SwapQuoteFn {
  return async ({ amountIn }) => ({
    amountOut: amountIn, // 1:1, no price effect on the amount itself
    priceImpactBps,
  });
}

describe("deriveRouteCandidates", () => {
  it("pairs a Blend collateral reserve only with a borrow reserve in the SAME pool contract", () => {
    const collateral = [
      makePoolInfo({
        id: "blend:CPOOL1:CUSTRY",
        metadata: { cFactor: 0.8 },
      }),
    ];
    const borrow = [
      makePoolInfo({
        id: "blend:CPOOL1:CUSDC",
        metadata: { borrowApy: 4.2 },
      }),
      makePoolInfo({
        id: "blend:CPOOLOTHER:CUSDC",
        metadata: { borrowApy: 1.0 }, // cheaper, but wrong pool contract
      }),
    ];

    const candidates = deriveRouteCandidates(collateral, borrow);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].collateralPoolId).toBe("blend:CPOOL1:CUSTRY");
    expect(candidates[0].borrowPoolId).toBe("blend:CPOOL1:CUSDC");
    expect(candidates[0].maxLtvPct).toBeCloseTo(80, 5);
    expect(candidates[0].borrowRatePct).toBeCloseTo(4.2, 5);
  });

  it("pairs every Neko collateral entry with every Neko borrow entry (fixed pool1/pool2 wiring)", () => {
    const collateral = [
      makePoolInfo({ id: "neko:USTRY", type: "neko", metadata: {} }),
    ];
    const borrow = [
      makePoolInfo({
        id: "neko:USDC",
        type: "neko",
        metadata: { borrowApy: 3 },
      }),
    ];
    const candidates = deriveRouteCandidates(collateral, borrow);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].poolType).toBe("neko");
    expect(candidates[0].maxLtvPct).toBeGreaterThan(0);
  });

  it("excludes pools that don't support the required action or are inactive", () => {
    const collateral = [
      makePoolInfo({
        id: "blend:CPOOL1:CUSTRY",
        supportedActions: ["deposit", "withdraw"], // no supplyCollateral
      }),
    ];
    const borrow = [
      makePoolInfo({ id: "blend:CPOOL1:CUSDC", state: "frozen" }),
    ];
    expect(deriveRouteCandidates(collateral, borrow)).toHaveLength(0);
  });
});

describe("selectRoute", () => {
  const cheap: RouteCandidatePool = {
    poolType: "blend",
    collateralPoolId: "blend:CPOOL1:CUSTRY",
    borrowPoolId: "blend:CPOOL1:CUSDC",
    maxLtvPct: 75,
    borrowRatePct: 3,
    availableLiquidity: "1000",
  };
  const expensive: RouteCandidatePool = {
    poolType: "neko",
    collateralPoolId: "neko:USTRY",
    borrowPoolId: "neko:USDC",
    maxLtvPct: 70,
    borrowRatePct: 9,
    availableLiquidity: "1000",
  };

  it("picks the lowest blended-cost pool when it has enough liquidity for every iteration", async () => {
    const result = await selectRoute({
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
      targetMultiple: 1.5,
      safetyBufferPct: 5,
      candidates: [cheap, expensive],
      getSwapQuote: flatQuote(10),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.iterations.every((it) => it.poolType === "blend")).toBe(true);
    expect(result.poolsUsed).toHaveLength(1);
    expect(result.poolsUsed[0].borrowPoolId).toBe(cheap.borrowPoolId);
  });

  it("falls over to a second (more expensive) pool once the cheapest pool's liquidity is exhausted — cross-protocol routing", async () => {
    // Enough for iteration 1 (needs 70) but exhausted immediately after —
    // every later iteration must fall back to the more expensive pool.
    const partiallyDrainedCheap: RouteCandidatePool = {
      ...cheap,
      availableLiquidity: "75",
    };
    const result = await selectRoute({
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
      targetMultiple: 2.5,
      safetyBufferPct: 5,
      candidates: [partiallyDrainedCheap, expensive],
      getSwapQuote: flatQuote(5),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.iterations[0].poolType).toBe("blend");
    const poolTypesUsed = new Set(result.iterations.map((it) => it.poolType));
    expect(poolTypesUsed.has("neko")).toBe(true);
    expect(result.poolsUsed.length).toBeGreaterThan(1);
  });

  it("rejects with INSUFFICIENT_ROUTE_LIQUIDITY when every eligible pool runs out of room", async () => {
    const result = await selectRoute({
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "1000",
      targetMultiple: 3,
      safetyBufferPct: 0,
      candidates: [
        { ...cheap, availableLiquidity: "1" },
        { ...expensive, availableLiquidity: "1" },
      ],
      getSwapQuote: flatQuote(0),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("INSUFFICIENT_ROUTE_LIQUIDITY");
  });

  it("rejects an unreachable target multiple before ever calling the swap quote", async () => {
    const getSwapQuote = vi.fn(flatQuote(0));
    const result = await selectRoute({
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
      targetMultiple: 10,
      safetyBufferPct: 30,
      candidates: [{ ...cheap, maxLtvPct: 40 }],
      getSwapQuote,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("UNREACHABLE_TARGET_MULTIPLE");
    expect(getSwapQuote).not.toHaveBeenCalled();
  });

  it("produces a pre-trade simulation whose totals match the known per-iteration outputs", async () => {
    const result = await selectRoute({
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
      targetMultiple: 1.5,
      safetyBufferPct: 5,
      candidates: [cheap],
      getSwapQuote: flatQuote(25),
      priceUsd: 100,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedSlippage = result.iterations.reduce(
      (sum, it) => sum + it.swapPriceImpactBps,
      0
    );
    expect(result.simulation.totalSlippageBps).toBe(expectedSlippage);
    expect(result.simulation.totalBorrowCostPct).toBeCloseTo(3, 5);
    expect(result.simulation.blendedEntryPrice).toBeCloseTo(
      100 * (1 + expectedSlippage / 10_000),
      6
    );
    // One deposit + one borrow + one swap step per iteration.
    expect(result.simulation.steps.length).toBe(result.iterations.length * 3);
  });

  it("rejects when no candidate pool has positive LTV headroom after the safety buffer", async () => {
    const result = await selectRoute({
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      initialCollateralAmount: "100",
      targetMultiple: 1.2,
      safetyBufferPct: 80,
      candidates: [cheap, expensive],
      getSwapQuote: flatQuote(0),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("NO_SUPPORTED_POOL");
  });
});
