/**
 * BasePoolAdapter — the contract every pool adapter must satisfy.
 *
 * Adapters are stateless services: they receive all context
 * (pool id, user address, amounts) as arguments and return
 * normalized results the Orchestrator can forward to the UI.
 */

import type {
  PoolAction,
  PoolInfo,
  PoolPosition,
  PoolType,
  TransactionResult,
} from "./pool.types";

export interface BasePoolAdapter {
  /** The pool type this adapter handles. */
  readonly type: PoolType;

  /**
   * Fetch normalized information for a single pool.
   * @param poolId - Unique pool identifier (without the `type:` prefix).
   */
  getPoolInfo(poolId: string): Promise<PoolInfo>;

  /**
   * List every pool this adapter knows about.
   * Used by `Orchestrator.getAllPools()` to aggregate across adapters.
   */
  listPools(): Promise<PoolInfo[]>;

  /**
   * Get the calling user's position in a given pool.
   * Returns zeroed position when the user has no stake.
   */
  getUserPosition(poolId: string, userAddress: string): Promise<PoolPosition>;

  /**
   * Build an unsigned deposit transaction.
   * @param tokenIndex - Which token in the pool's `tokens` array to deposit
   *                     (only relevant for multi-token pools like SoroSwap).
   */
  deposit(
    poolId: string,
    userAddress: string,
    amount: bigint,
    tokenIndex?: number
  ): Promise<TransactionResult>;

  /**
   * Build an unsigned withdraw transaction.
   * @param tokenIndex - Which token to withdraw (multi-token pools).
   */
  withdraw(
    poolId: string,
    userAddress: string,
    amount: bigint,
    tokenIndex?: number
  ): Promise<TransactionResult>;

  /**
   * Build an unsigned claim-rewards transaction.
   * Adapters that don't support rewards should throw
   * `UnsupportedActionError`.
   */
  claimRewards(poolId: string, userAddress: string): Promise<TransactionResult>;

  /**
   * Build an unsigned borrow transaction.
   * Only required for lending-protocol adapters (Blend, etc.).
   */
  borrow?(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult>;

  /**
   * Build an unsigned repay transaction.
   * Only required for lending-protocol adapters (Blend, etc.).
   */
  repay?(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult>;

  /** Runtime check for whether this adapter supports a given action. */
  supportsAction(action: PoolAction): boolean;
}
