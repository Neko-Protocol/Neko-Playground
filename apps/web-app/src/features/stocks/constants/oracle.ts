/**
 * Oracle-related constants. Use these instead of magic numbers across the stocks feature.
 */

/** Oracle price precision (decimal places stored on-chain). */
export const ORACLE_DECIMALS = 14;

/** Number of decimal places to show in UI for prices. */
export const PRICE_DISPLAY_DECIMALS = 2;

/** Max number of assets to show in the Oracle grid. */
export const MAX_ASSETS_DISPLAY = 6;

/** Number of price history records to fetch from the oracle. */
export const PRICE_HISTORY_RECORDS = 10;

/** Max number of recent prices to show in the asset card list. */
export const MAX_RECENT_PRICES_IN_CARD = 5;

/** Timestamp from oracle is in seconds; multiply by this to get milliseconds. */
export const TIMESTAMP_MS_PER_SECOND = 1000;

/** Base path for stocks/oracle dashboard routes. */
export const ROUTES = {
  STOCKS_BASE: "/dashboard/stocks",
  /** Path for a single asset detail page. Use with `${ROUTES.STOCKS_BASE}/${symbol}` */
  stockDetail: (symbol: string) => `${ROUTES.STOCKS_BASE}/${symbol}`,
} as const;

/** Chart line/accent color (hex) for price charts. Matches neko-teal. */
export const CHART_ACCENT_COLOR = "#39bfb7";

/** Default React Query staleTime for oracle price data (ms). Align with typical resolution (e.g. 60s). */
export const ORACLE_PRICE_STALE_MS = 60_000;

/** Decimals never change on-chain; cache forever. */
export const ORACLE_DECIMALS_STALE_MS = Infinity;
