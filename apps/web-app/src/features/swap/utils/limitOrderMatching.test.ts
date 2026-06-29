import { matchLimitOrder, deriveMarketPrice } from "./limitOrderMatching";

// ─── Buy limit ────────────────────────────────────────────────────────────────

describe("matchLimitOrder – buy limit", () => {
  it("triggers when market price is below limit price (no slippage)", () => {
    const result = matchLimitOrder({
      side: "buy",
      limitPrice: 0.15,
      currentPrice: 0.12,
      slippageBps: 0,
    });
    expect(result.shouldTrigger).toBe(true);
    expect(result.effectivePrice).toBeCloseTo(0.12);
  });

  it("does NOT trigger when market price exceeds limit price", () => {
    const result = matchLimitOrder({
      side: "buy",
      limitPrice: 0.1,
      currentPrice: 0.12,
      slippageBps: 0,
    });
    expect(result.shouldTrigger).toBe(false);
  });

  it("triggers when effective price (with slippage) is still ≤ limit", () => {
    // limitPrice = 0.15, current = 0.13, slippage 5% → effective ≈ 0.1365 ≤ 0.15
    const result = matchLimitOrder({
      side: "buy",
      limitPrice: 0.15,
      currentPrice: 0.13,
      slippageBps: 500,
    });
    expect(result.shouldTrigger).toBe(true);
    expect(result.effectivePrice).toBeCloseTo(0.1365);
  });
});

// ─── Sell limit ───────────────────────────────────────────────────────────────

describe("matchLimitOrder – sell limit", () => {
  it("triggers when market price exceeds limit price (no slippage)", () => {
    const result = matchLimitOrder({
      side: "sell",
      limitPrice: 0.1,
      currentPrice: 0.12,
      slippageBps: 0,
    });
    expect(result.shouldTrigger).toBe(true);
    expect(result.effectivePrice).toBeCloseTo(0.12);
  });

  it("does NOT trigger when market price is below limit price", () => {
    const result = matchLimitOrder({
      side: "sell",
      limitPrice: 0.15,
      currentPrice: 0.12,
      slippageBps: 0,
    });
    expect(result.shouldTrigger).toBe(false);
  });
});

// ─── Slippage edge cases ──────────────────────────────────────────────────────

describe("matchLimitOrder – slippage edge cases", () => {
  it("sell: does NOT trigger when slippage pulls effective price below limit", () => {
    // limitPrice = 0.12, current = 0.12, slippage 5% → effective ≈ 0.114 < 0.12
    const result = matchLimitOrder({
      side: "sell",
      limitPrice: 0.12,
      currentPrice: 0.12,
      slippageBps: 500,
    });
    expect(result.shouldTrigger).toBe(false);
    expect(result.effectivePrice).toBeCloseTo(0.114);
  });

  it("buy: does NOT trigger when slippage pushes effective price above limit", () => {
    // limitPrice = 0.12, current = 0.12, slippage 5% → effective ≈ 0.126 > 0.12
    const result = matchLimitOrder({
      side: "buy",
      limitPrice: 0.12,
      currentPrice: 0.12,
      slippageBps: 500,
    });
    expect(result.shouldTrigger).toBe(false);
    expect(result.effectivePrice).toBeCloseTo(0.126);
  });

  it("returns shouldTrigger=false for invalid inputs (zero price)", () => {
    const result = matchLimitOrder({
      side: "sell",
      limitPrice: 0,
      currentPrice: 0.12,
      slippageBps: 0,
    });
    expect(result.shouldTrigger).toBe(false);
    expect(result.effectivePrice).toBe(0);
  });
});

// ─── deriveMarketPrice ────────────────────────────────────────────────────────

describe("deriveMarketPrice", () => {
  it("correctly computes tokenOut per tokenIn", () => {
    // 100 XLM → 12.5 USDC → price = 0.125 USDC/XLM
    expect(deriveMarketPrice("100", "12.5")).toBeCloseTo(0.125);
  });

  it("returns NaN for zero amountIn", () => {
    expect(deriveMarketPrice("0", "12.5")).toBeNaN();
  });
});
