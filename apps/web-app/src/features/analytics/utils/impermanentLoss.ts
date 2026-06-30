/**
 * Impermanent loss fraction for a constant-product (50/50) pool.
 * @param priceRatioChange - currentPrice / entryPrice for the volatile asset
 * @returns negative fraction representing the loss relative to HODL (e.g. -0.057)
 */
export function impermanentLoss(priceRatioChange: number): number {
  if (priceRatioChange <= 0) return 0;
  const k = Math.sqrt(priceRatioChange);
  return (2 * k) / (1 + priceRatioChange) - 1;
}

/** IL expressed as a percentage (negative = loss). */
export function impermanentLossPct(priceRatioChange: number): number {
  return impermanentLoss(priceRatioChange) * 100;
}

/** IL in USD given the HODL value and the price ratio change. */
export function ilInUsd(hodlValue: number, priceRatioChange: number): number {
  return hodlValue * impermanentLoss(priceRatioChange);
}
