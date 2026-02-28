/**
 * Address and network display helpers.
 */

/**
 * Truncate an address (or any string) with ellipsis.
 * @param value - Full address string
 * @param start - Number of characters to show at the start (default 4)
 * @param end - Number of characters to show at the end (default 4)
 */
export function truncateAddress(value: string, start = 4, end = 4): string {
  if (value.length <= start + end) return value;
  return `${value.slice(0, start)}…${value.slice(-end)}`;
}

/**
 * Format network name for display.
 * STANDALONE (deprecated) is shown as "Local"; otherwise first letter uppercase, rest lowercase.
 */
export function formatNetworkName(name: string): string {
  return name === "STANDALONE"
    ? "Local"
    : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
