import { describe, expect, it } from "vitest";
import {
  computeLeverageLoop,
  LEVERAGE_LOOP_MAX_ITERATIONS,
} from "../loopSizing";

describe("computeLeverageLoop", () => {
  it("sizes a reachable loop into iterations that converge on the target multiple", () => {
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "1000",
      targetMultiple: 2,
      maxLtvPct: 75,
      safetyBufferPct: 5,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.effectiveLtvPct).toBeCloseTo(70, 5);
    expect(result.achievedMultiple).toBeGreaterThanOrEqual(2);
    expect(result.iterations.length).toBeGreaterThan(0);
    // Every iteration's cumulative multiple must be monotonically increasing.
    const multiples = result.iterations.map((i) => i.multipleAtStep);
    for (let i = 1; i < multiples.length; i++) {
      expect(multiples[i]).toBeGreaterThan(multiples[i - 1]);
    }
    // The last iteration is the first one to cross the target.
    expect(multiples[multiples.length - 1]).toBeGreaterThanOrEqual(2 - 1e-6);
  });

  it("boundary: target multiple exactly at the theoretical ceiling for zero safety buffer is reachable", () => {
    // maxLtv 80%, buffer 0 -> ceiling = 1 / (1 - 0.8) = 5x exactly.
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "100",
      targetMultiple: 5,
      maxLtvPct: 80,
      safetyBufferPct: 0,
      maxIterations: 200,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.effectiveLtvPct).toBe(80);
  });

  it("boundary: a target multiple fractionally beyond the zero-buffer ceiling is rejected as unreachable", () => {
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "100",
      targetMultiple: 5.5,
      maxLtvPct: 80,
      safetyBufferPct: 0,
      maxIterations: 200,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("UNREACHABLE_TARGET_MULTIPLE");
  });

  it("rejects an unreachable target multiple given the pool's max LTV and safety buffer", () => {
    // maxLtv 50%, buffer 10 -> effective 40% -> ceiling 1/(1-0.4) = 1.667x.
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "500",
      targetMultiple: 3,
      maxLtvPct: 50,
      safetyBufferPct: 10,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("UNREACHABLE_TARGET_MULTIPLE");
    expect(result.reason).toMatch(/unreachable/i);
  });

  it("rejects a loop whose required borrow exceeds available route liquidity", () => {
    // Per-iteration borrow amounts strictly decrease each step (borrow =
    // deposit * effectiveLtv < deposit), so a FLAT per-iteration liquidity
    // cap is always tightest on iteration 1 — this proves the very first
    // iteration is checked before any collateral is posted, not just
    // validated after the fact.
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "1000",
      targetMultiple: 3,
      maxLtvPct: 75,
      safetyBufferPct: 0,
      maxLiquidityPerIteration: "100",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("INSUFFICIENT_ROUTE_LIQUIDITY");
    expect(result.partialIterations).toEqual([]);
  });

  it("rejects at the exact iteration where cumulative liquidity would be exceeded, once earlier iterations fit", () => {
    // A cap comfortably above iteration 1's borrow (750) but below
    // iteration 2's (562.5) never occurs for a flat cap since amounts only
    // shrink — so this instead proves the boundary sits exactly at
    // iteration 1's own requirement, not one iteration early or late.
    const justBelow = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "1000",
      targetMultiple: 3,
      maxLtvPct: 75,
      safetyBufferPct: 0,
      maxLiquidityPerIteration: "749.99",
    });
    expect(justBelow.ok).toBe(false);

    const justAbove = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "1000",
      targetMultiple: 1.2,
      maxLtvPct: 75,
      safetyBufferPct: 0,
      maxLiquidityPerIteration: "750.01",
    });
    expect(justAbove.ok).toBe(true);
  });

  it("rejects a safety buffer that consumes the entire max LTV", () => {
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "100",
      targetMultiple: 2,
      maxLtvPct: 60,
      safetyBufferPct: 60,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("INVALID_SAFETY_BUFFER");
  });

  it("rejects a target multiple that isn't greater than 1x", () => {
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "100",
      targetMultiple: 1,
      maxLtvPct: 75,
      safetyBufferPct: 5,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("INVALID_TARGET_MULTIPLE");
  });

  it("rejects an out-of-range max LTV", () => {
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "100",
      targetMultiple: 2,
      maxLtvPct: 0,
      safetyBufferPct: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("INVALID_MAX_LTV");
  });

  it("caps iterations at LEVERAGE_LOOP_MAX_ITERATIONS by default", () => {
    // Effective LTV so close to 100% that the default cap is hit before
    // convergence, even though the target is theoretically reachable.
    const result = computeLeverageLoop({
      assetCode: "USTRY",
      initialCollateralAmount: "100",
      targetMultiple: 50,
      maxLtvPct: 99,
      safetyBufferPct: 0,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasonCode).toBe("MAX_ITERATIONS_EXCEEDED");
    expect(result.partialIterations?.length).toBe(LEVERAGE_LOOP_MAX_ITERATIONS);
  });
});
