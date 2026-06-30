/** Compound APR → APY with `periods` compounding intervals per year (default: daily). */
export function aprToApy(apr: number, periods = 365): number {
  return (Math.pow(1 + apr / periods, periods) - 1) * 100;
}

/** Weighted blended APY across positions with USD sizing. */
export function blendedApy(
  positions: { apy: number; valueUsd: number }[]
): number {
  const total = positions.reduce((s, p) => s + p.valueUsd, 0);
  if (total === 0) return 0;
  return positions.reduce((s, p) => s + (p.apy * p.valueUsd) / total, 0);
}

/** Net APY after subtracting weighted borrow cost. */
export function netApy(blended: number, borrowCost: number): number {
  return blended - borrowCost;
}

/** Project compound earnings over N days given principal and annual APY (%). */
export function projectEarnings(
  principal: number,
  apyPct: number,
  days: number
): number {
  const apy = apyPct / 100;
  return principal * (Math.pow(1 + apy, days / 365) - 1);
}
