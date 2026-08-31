export type PoolType = "blend" | "neko" | "soroswap" | "custom";

export type PoolState = "active" | "frozen" | "on_ice" | "unknown";

export type PoolAction =
  | "deposit"
  | "withdraw"
  | "claimRewards"
  | "borrow"
  | "repay"
  | "supplyCollateral"
  | "withdrawCollateral";

export interface TokenInfo {
  address: string;

  code: string;

  name: string;

  decimals: number;
}

export interface PoolInfo {
  id: string;
  type: PoolType;
  name: string;
  tokens: TokenInfo[];

  tvl: bigint;

  apy: number;
  state: PoolState;

  supportedActions: PoolAction[];

  metadata: Record<string, unknown>;
}

/**
 * Per-action ceiling on the amount a user may submit, in the smallest units of
 * the pool's asset.
 *
 * An action is present only when the adapter can derive a real ceiling for it.
 * An absent action means "no known cap" — callers must not treat that as zero,
 * and must not offer a Max button for it.
 *
 * Ceilings are bucket-aware: on a lending pool each action moves one specific
 * on-chain balance, so `withdraw` and `withdrawCollateral` have separate
 * ceilings even when they target the same reserve.
 */
export type PoolActionLimits = Partial<Record<PoolAction, bigint>>;

export interface PoolPosition {
  poolId: string;

  /**
   * Aggregate of every balance the user has supplied to the pool
   * (`supplied + collateral` on a lending pool).
   *
   * This is a display total only. It spans two distinct on-chain balances and
   * no single action can move all of it — never derive an action amount from
   * it, use `limits` instead.
   */
  deposited: bigint;

  depositedFormatted: string;

  /** Non-collateralized supply. Withdrawable via `withdraw`. */
  supplied: bigint;

  suppliedFormatted: string;

  /** Collateralized supply. Withdrawable via `withdrawCollateral`. */
  collateral: bigint;

  collateralFormatted: string;

  /** Outstanding debt. Settled via `repay`. */
  liabilities: bigint;

  liabilitiesFormatted: string;

  rewards: bigint;

  rewardsFormatted: string;

  /** Maximum submittable amount per action. See {@link PoolActionLimits}. */
  limits: PoolActionLimits;

  metadata: Record<string, unknown>;
}

export interface TransactionResult {
  xdr: string;
  networkPassphrase: string;
}

export interface PoolActionResult {
  tx: TransactionResult;

  preTx?: TransactionResult;
}
