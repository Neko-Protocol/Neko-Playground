export const ORACLE_DECIMALS = 14;

export const PRICE_DISPLAY_DECIMALS = 2;

export const MAX_ASSETS_DISPLAY = 6;

export const PRICE_HISTORY_RECORDS = 10;

export const MAX_RECENT_PRICES_IN_CARD = 5;

export const TIMESTAMP_MS_PER_SECOND = 1000;

export const ROUTES = {
  STOCKS_BASE: "/discover",

  stockDetail: (symbol: string) => `${ROUTES.STOCKS_BASE}/${symbol}`,
} as const;

export const CHART_ACCENT_COLOR = "#39bfb7";

export const ORACLE_PRICE_STALE_MS = 60_000;

export const ORACLE_DECIMALS_STALE_MS = Infinity;
