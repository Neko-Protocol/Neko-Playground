/**
 * Core domain types for the Pool Orchestrator.
 * These are the unified types that the frontend consumes —
 * every adapter normalizes its data into these shapes.
 */

/** Discriminator for pool backend implementations. */
export type PoolType = "blend" | "neko" | "soroswap" | "custom";

/** Lifecycle state of a pool (maps to Soroban PoolState or API status). */
export type PoolState = "active" | "frozen" | "on_ice" | "unknown";

/** Actions a pool can support — not every pool supports every action. */
export type PoolAction =
  | "deposit"
  | "withdraw"
  | "claimRewards"
  | "borrow"
  | "repay"
  | "supplyCollateral"
  | "withdrawCollateral";

/** Minimal token descriptor used inside pool metadata. */
export interface TokenInfo {
  /** Stellar contract address (C…). */
  address: string;
  /** Human-readable symbol, e.g. "USDC". */
  code: string;
  /** Display name, e.g. "USDCoin". */
  name: string;
  /** On-chain decimals (typically 7 on Stellar). */
  decimals: number;
}

/**
 * Normalized pool information returned by every adapter.
 * The `metadata` bag carries adapter-specific extras the UI can opt-in to.
 */
export interface PoolInfo {
  /** Unique pool identifier (format: `<type>:<contractOrPairId>`). */
  id: string;
  type: PoolType;
  name: string;
  tokens: TokenInfo[];
  /** Total value locked expressed in the pool's smallest unit. */
  tvl: bigint;
  /** Annualised percentage yield (already divided, e.g. 5.25 = 5.25%). */
  apy: number;
  state: PoolState;
  /** Actions this specific pool supports. */
  supportedActions: PoolAction[];
  /** Adapter-specific data the UI may render conditionally. */
  metadata: Record<string, unknown>;
}

/**
 * A user's position in a pool.
 * Adapters populate whichever fields are relevant.
 */
export interface PoolPosition {
  poolId: string;
  /** Deposited / supplied amount (smallest unit). */
  deposited: bigint;
  /** Human-readable deposited string. */
  depositedFormatted: string;
  /** Unclaimed rewards (smallest unit), 0n when N/A. */
  rewards: bigint;
  /** Human-readable rewards string. */
  rewardsFormatted: string;
  /** Adapter-specific position data. */
  metadata: Record<string, unknown>;
}

/**
 * Result of a write operation — an unsigned XDR envelope
 * ready for wallet signing.
 */
export interface TransactionResult {
  /** Base-64 XDR of the prepared (simulated) transaction. */
  xdr: string;
  networkPassphrase: string;
}

/**
 * Wrapper returned by the Orchestrator for every mutation,
 * including an optional pre-step (e.g. token approval).
 */
export interface PoolActionResult {
  /** Primary transaction XDR. */
  tx: TransactionResult;
  /** Optional preceding transaction (e.g. token approve). */
  preTx?: TransactionResult;
}
