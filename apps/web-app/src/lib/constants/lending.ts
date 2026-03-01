/**
 * Lending feature configuration
 * Single source of truth for fees, timeouts, and debt assets
 */

export const LENDING_CONFIG = {
  /** Stellar transaction fee in stroops */
  fee: "100",
  /** Transaction timeout in ledger bounds */
  timeout: 300,
  /** Delay (ms) after approve tx before submitting deposit */
  approveDelayMs: 2000,
  /** Delay (ms) after deposit/withdraw tx before refreshing */
  postTxDelayMs: 3000,
  /** bToken rate decimals from contract (SCALAR_9) */
  bTokenDecimals: 9,
  /** Divisor for borrow limit (USD value from oracle, 7 decimals) */
  borrowLimitDivisor: 1e7,
} as const;

/** Debt asset codes supported by the lending contract (used for pool discovery) */
export const LENDING_DEBT_ASSETS = ["USDC", "XLM"] as const;
