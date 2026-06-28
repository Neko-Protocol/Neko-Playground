/**
 * Herfindahl–Hirschman Index (0–10 000).
 * Pass absolute values (not fractions) — the function normalises internally.
 */
export function hhi(values: number[]): number {
  const total = values.reduce((s, x) => s + x, 0);
  if (total === 0) return 0;
  return values.reduce((s, x) => s + Math.pow((x / total) * 100, 2), 0);
}

/**
 * Diversification score 0–100 (100 = perfectly spread across many assets).
 * A HHI of 10 000 scores 0; a well-diversified portfolio (HHI ≈ 1 000) scores ~90.
 */
export function diversificationScore(hhiValue: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - hhiValue / 100)));
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 * Returns null if the arrays are too short or have zero variance.
 */
export function pearsonCorrelation(
  a: number[],
  b: number[]
): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 2) return null;

  const meanA = a.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const meanB = b.slice(0, n).reduce((s, x) => s + x, 0) / n;

  let num = 0;
  let denA = 0;
  let denB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  return den === 0 ? null : num / den;
}

/** Build an NxN pairwise correlation matrix from return series. */
export function correlationMatrix(returnSeries: number[][]): number[][] {
  const n = returnSeries.length;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      return pearsonCorrelation(returnSeries[i], returnSeries[j]) ?? 0;
    })
  );
}
