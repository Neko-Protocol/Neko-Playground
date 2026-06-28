export interface DrawdownResult {
  drawdownSeries: number[];
  maxDrawdown: number;
  maxDrawdownIndex: number;
}

/** Compute a drawdown series (% below running peak) from a NAV array. */
export function computeDrawdown(navSeries: number[]): DrawdownResult {
  if (navSeries.length === 0) {
    return { drawdownSeries: [], maxDrawdown: 0, maxDrawdownIndex: 0 };
  }

  let peak = navSeries[0];
  let maxDrawdown = 0;
  let maxDrawdownIndex = 0;
  const drawdownSeries: number[] = [];

  for (let i = 0; i < navSeries.length; i++) {
    const nav = navSeries[i];
    if (nav > peak) peak = nav;
    const dd = peak > 0 ? ((nav - peak) / peak) * 100 : 0;
    drawdownSeries.push(dd);
    if (Math.abs(dd) > maxDrawdown) {
      maxDrawdown = Math.abs(dd);
      maxDrawdownIndex = i;
    }
  }

  return { drawdownSeries, maxDrawdown, maxDrawdownIndex };
}
