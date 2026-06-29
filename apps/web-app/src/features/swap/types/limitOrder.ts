import type { Token } from "@/lib/helpers/stellar/soroswap";

// ─── Enums / Discriminated Unions ────────────────────────────────────────────

/** Whether the user wants to buy or sell the base token at a limit price. */
export type LimitOrderSide = "buy" | "sell";

/** Lifecycle status of a limit order. */
export type LimitOrderStatus =
  "open" | "ready" | "filled" | "cancelled" | "expired";

/**
 * Expiry options for a limit order.
 * "gtc" = Good-til-cancelled.
 */
export type LimitOrderExpiry = "24h" | "7d" | "30d" | "gtc";

// ─── Core Order Shape ─────────────────────────────────────────────────────────

export interface LimitOrder {
  /** Unique identifier (UUID v4). */
  id: string;

  /** Stellar wallet address that created the order. */
  walletAddress: string;

  /** Token the user is selling. */
  tokenIn: Token | string;

  /** Token the user is buying. */
  tokenOut: Token | string;

  /** Human-readable symbol of tokenIn (e.g. "XLM"). */
  tokenInSymbol: string;

  /** Human-readable symbol of tokenOut (e.g. "USDC"). */
  tokenOutSymbol: string;

  /** Amount of tokenIn to sell (decimal string, e.g. "100.5"). */
  amountIn: string;

  /**
   * Limit price expressed as units of tokenOut per one unit of tokenIn.
   * e.g. if selling XLM for USDC at 0.12, limitPrice = "0.12"
   */
  limitPrice: string;

  /** Buy or sell side. */
  side: LimitOrderSide;

  /** Slippage tolerance in basis points. */
  slippageBps: number;

  /** Lifecycle status. */
  status: LimitOrderStatus;

  /** UTC timestamp (ms) when the order was created. */
  createdAt: number;

  /** UTC timestamp (ms) when the order expires; null for GTC. */
  expiresAt: number | null;

  /**
   * Consecutive polls that have confirmed the price condition.
   * Resets to 0 whenever the condition is NOT met.
   */
  consecutiveConfirmations: number;

  /** UTC timestamp (ms) when the order was filled; null while open. */
  filledAt: number | null;
}

// ─── Storage Schema ───────────────────────────────────────────────────────────

export interface LimitOrderStorageSchema {
  version: number;
  orders: LimitOrder[];
}

// ─── Helper Maps ─────────────────────────────────────────────────────────────

export const EXPIRY_LABELS: Record<LimitOrderExpiry, string> = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  gtc: "Good-til-cancelled",
};

/** Duration in milliseconds for each expiry option; null = GTC (never). */
export const EXPIRY_MS: Record<LimitOrderExpiry, number | null> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  gtc: null,
};
