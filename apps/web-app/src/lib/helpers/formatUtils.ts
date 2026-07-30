export function safeParseFloat(
  value: string | number | null | undefined
): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/,/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseBalance(balance: string | null | undefined): number {
  return safeParseFloat(balance);
}

export function formatLiquidity(value: number | string): string {
  const num = safeParseFloat(value);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(2)}k`;
  return `$${num.toFixed(2)}`;
}

/**
 * Format a USD value for display. Values are genuinely USD (computed via oracle prices).
 * `null` means no price source was available for the asset.
 */
export function formatUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Price unavailable";
  }
  return formatLiquidity(value);
}

/**
 * Format a token amount for display, trimming trailing zeros and adapting
 * decimal places to the magnitude of the value.
 *
 * Examples:
 *   1.0000000  → "1"
 *   0.0100000  → "0.01"
 *   100.12300  → "100.123"
 *   0.0000015  → "0.0000015"
 */
export function formatAmount(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num) || num === 0) return "0";

  if (num >= 1_000_000) return `${parseFloat((num / 1_000_000).toFixed(2))}M`;
  if (num >= 1_000)
    return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  // For numbers >= 0.001 show up to 4 decimals, trim trailing zeros
  if (num >= 0.001) return parseFloat(num.toFixed(4)).toString();
  // Very small: show up to 7 significant decimals, trim trailing zeros
  return parseFloat(num.toFixed(7)).toString();
}
