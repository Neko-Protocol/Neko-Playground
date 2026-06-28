/** Annualised Sharpe ratio from a daily-returns series and a risk-free annual rate. */
export function sharpeRatio(
  dailyReturns: number[],
  riskFreeRateAnnual = 0.05
): number | null {
  if (dailyReturns.length < 2) return null;
  const rfDaily = riskFreeRateAnnual / 365;
  const excess = dailyReturns.map((r) => r - rfDaily);
  const mean = excess.reduce((s, r) => s + r, 0) / excess.length;
  const variance =
    excess.reduce((s, r) => s + Math.pow(r - mean, 2), 0) /
    (excess.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return null;
  return (mean / stdDev) * Math.sqrt(365);
}

/** Annualised Sortino ratio — penalises downside volatility only. */
export function sortinoRatio(
  dailyReturns: number[],
  targetReturn = 0
): number | null {
  if (dailyReturns.length < 2) return null;
  const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
  const downsideVariance =
    dailyReturns
      .filter((r) => r < targetReturn)
      .reduce((s, r) => s + Math.pow(r - targetReturn, 2), 0) /
    dailyReturns.length;
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return null;
  return ((mean - targetReturn) * 365) / (downsideDev * Math.sqrt(365));
}

/** Daily log-returns from a NAV series. */
export function dailyReturns(navSeries: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < navSeries.length; i++) {
    if (navSeries[i - 1] > 0) {
      returns.push((navSeries[i] - navSeries[i - 1]) / navSeries[i - 1]);
    }
  }
  return returns;
}
