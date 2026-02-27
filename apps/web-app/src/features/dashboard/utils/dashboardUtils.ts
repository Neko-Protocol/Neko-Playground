/**
 * Formats a numeric balance into a human-readable liquidity string.
 * e.g. 1500000 → "$1.50M", 2500 → "$2.50k", 42 → "$42.00"
 */
export function formatLiquidity(balanceStr: string): string {
  const num = parseBalance(balanceStr);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}k`;
  return `$${num.toFixed(2)}`;
}

/**
 * Safely parses a balance string (may contain commas) to a number.
 * Returns 0 if the string is empty, null, undefined, or not a valid number.
 */
export function parseBalance(balance: string | null | undefined): number {
  if (!balance) return 0;
  const cleaned = balance.replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}
