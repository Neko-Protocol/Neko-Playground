export const DEBOUNCE_MS = 50;

/** Fee buffer (in XLM) reserved for transaction fees when computing Max spendable XLM */
export const XLM_FEE_BUFFER = 0.01;

export const QUOTE_REFRESH_INTERVAL_MS = 5000;

export const DEFAULT_SLIPPAGE_BPS = 500;

export const MAX_HOPS = 3;

export const SUSPICIOUS_VALUE_THRESHOLD_PCT = 10;

export const ORDER_HISTORY_LIMIT = 20;

// ─── Limit Order ──────────────────────────────────────────────────────────────

/** How often the monitor polls the quote API for each open limit order (ms). */
export const LIMIT_ORDER_POLL_INTERVAL_MS = 15_000;

/**
 * Number of consecutive polls that must confirm the price condition before
 * an order is marked "ready to fill". Guards against stale/noisy quotes.
 */
export const LIMIT_ORDER_CONFIRM_POLLS = 2;

/** localStorage schema version; bump when the LimitOrder shape changes. */
export const LIMIT_ORDER_STORAGE_VERSION = 1;
