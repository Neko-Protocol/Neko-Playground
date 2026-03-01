/**
 * NaN-safe parse: returns 0 for NaN, null, undefined, or invalid input.
 */
export function safeParseFloat(
  value: string | number | null | undefined
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Safely parses a balance string (may contain commas) to a number.
 * Returns 0 if the string is empty, null, undefined, or not a valid number.
 */
export function parseBalance(balance: string | null | undefined): number {
  return safeParseFloat(balance);
}

/**
 * Formats a numeric value into a human-readable liquidity string.
 * Accepts number or string; treats NaN/invalid as 0.
 * e.g. 1500000 → "$1.50M", 2500 → "$2.50k", 42 → "$42.00"
 */
export function formatLiquidity(value: number | string): string {
  const num = safeParseFloat(value);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}k`;
  return `$${num.toFixed(2)}`;
}
