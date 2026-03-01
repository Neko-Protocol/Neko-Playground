/**
 * Lending feature constants
 */

/** Asset codes supported by the lending pools */
export const LENDING_ASSETS = ["USDC", "XLM"] as const;

/** bToken rate uses 9 decimal places */
export const BTOKEN_DECIMALS = 9;

/** Delays (ms) between sequential lending transactions */
export const LENDING_DELAYS = {
  /** Wait after approve before submitting deposit */
  afterApprove: 2000,
  /** Wait after the full transaction flow before refreshing */
  afterTransaction: 3000,
} as const;
