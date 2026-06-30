export function estimateSlippageBps(
  amountUsd: number,
  liquidityUsd: number
): number {
  if (liquidityUsd <= 0) return 10_000; // 100% — no liquidity
  // Simple square-root price impact model
  const impact = Math.sqrt(amountUsd / liquidityUsd) * 100; // percentage
  return Math.round(impact * 100); // basis points
}

export function isSlippageAcceptable(
  estimatedSlippageBps: number,
  tolerancePct: number
): boolean {
  return estimatedSlippageBps <= tolerancePct * 100;
}
