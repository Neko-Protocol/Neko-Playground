/** Debounce delay before firing a quote request (ms) */
export const DEBOUNCE_MS = 50;

/** Quote auto-refresh interval (ms) */
export const QUOTE_REFRESH_INTERVAL_MS = 5000;

/** Default slippage tolerance in basis points (500 = 5%) */
export const DEFAULT_SLIPPAGE_BPS = 500;

/** Maximum route hops for Soroswap quotes */
export const MAX_HOPS = 1;

/** Threshold above which a swap output is flagged as suspiciously low (%) */
export const SUSPICIOUS_VALUE_THRESHOLD_PCT = 10;

/** Maximum number of orders shown in order history */
export const ORDER_HISTORY_LIMIT = 20;
