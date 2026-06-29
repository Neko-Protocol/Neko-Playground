import type { LimitOrderSide } from "../types/limitOrder";

// ─── Input / Output ───────────────────────────────────────────────────────────

export interface LimitMatchInput {
  /** "buy" = user wants to buy tokenOut; trigger when market price ≤ limitPrice.
   *  "sell" = user wants to sell tokenIn; trigger when market price ≥ limitPrice. */
  side: LimitOrderSide;

  /** User-defined limit price (tokenOut per tokenIn). */
  limitPrice: number;

  /**
   * Current market price returned by the quote API (tokenOut per tokenIn).
   * Derived from: quoteAmountOut / amountIn.
   */
  currentPrice: number;

  /** Slippage tolerance in basis points (e.g. 500 = 5%). */
  slippageBps: number;
}

export interface LimitMatchResult {
  /** True when the order should be triggered (confirmed by double-poll logic outside). */
  shouldTrigger: boolean;

  /**
   * The effective worst-case price after slippage.
   * For a buy: currentPrice * (1 + slippageBps / 10_000)
   * For a sell: currentPrice * (1 - slippageBps / 10_000)
   */
  effectivePrice: number;
}

// ─── Pure Matching Logic ──────────────────────────────────────────────────────

/**
 * Pure, side-effect-free function that decides whether a limit order
 * should be triggered given the current market price.
 *
 * - **Buy limit**: trigger when currentPrice ≤ limitPrice
 *   (after adding slippage the user still gets a price ≤ their limit).
 * - **Sell limit**: trigger when currentPrice ≥ limitPrice
 *   (after subtracting slippage the user still receives ≥ their limit).
 *
 * The double-poll confirmation (requiring 2 consecutive triggers) is
 * handled by the caller (`useLimitOrderMonitor`) so this function
 * remains purely testable.
 */
export function matchLimitOrder(input: LimitMatchInput): LimitMatchResult {
  const { side, limitPrice, currentPrice, slippageBps } = input;

  if (
    !isFinite(limitPrice) ||
    !isFinite(currentPrice) ||
    !isFinite(slippageBps) ||
    limitPrice <= 0 ||
    currentPrice <= 0 ||
    slippageBps < 0
  ) {
    return { shouldTrigger: false, effectivePrice: 0 };
  }

  const slippageFraction = slippageBps / 10_000;

  if (side === "buy") {
    // User wants to buy tokenOut cheaply.
    // Effective price is higher (they pay up to limitPrice after slippage).
    const effectivePrice = currentPrice * (1 + slippageFraction);
    const shouldTrigger = effectivePrice <= limitPrice;
    return { shouldTrigger, effectivePrice };
  }

  // side === "sell"
  // User wants to sell tokenIn at a high price.
  // Effective price is lower (slippage eats into what they receive).
  const effectivePrice = currentPrice * (1 - slippageFraction);
  const shouldTrigger = effectivePrice >= limitPrice;
  return { shouldTrigger, effectivePrice };
}

// ─── Derived price helper ─────────────────────────────────────────────────────

/**
 * Compute the market price (tokenOut per tokenIn) from a quote.
 * Returns NaN when inputs are invalid.
 */
export function deriveMarketPrice(
  amountIn: string,
  quoteAmountOut: string
): number {
  const parsedIn = parseFloat(amountIn);
  const parsedOut = parseFloat(quoteAmountOut);

  if (!parsedIn || !parsedOut || parsedIn <= 0 || parsedOut <= 0) return NaN;
  return parsedOut / parsedIn;
}
