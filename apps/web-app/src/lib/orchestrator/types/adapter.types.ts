import type {
  PoolAction,
  PoolInfo,
  PoolPosition,
  PoolType,
  TransactionResult,
} from "./pool.types";

export interface BasePoolAdapter {
  readonly type: PoolType;

  getPoolInfo(poolId: string): Promise<PoolInfo>;

  listPools(): Promise<PoolInfo[]>;

  getUserPosition(poolId: string, userAddress: string): Promise<PoolPosition>;

  deposit(
    poolId: string,
    userAddress: string,
    amount: bigint,
    tokenIndex?: number
  ): Promise<TransactionResult>;

  withdraw(
    poolId: string,
    userAddress: string,
    amount: bigint,
    tokenIndex?: number
  ): Promise<TransactionResult>;

  claimRewards(poolId: string, userAddress: string): Promise<TransactionResult>;

  borrow?(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult>;

  repay?(
    poolId: string,
    userAddress: string,
    amount: bigint
  ): Promise<TransactionResult>;

  supportsAction(action: PoolAction): boolean;
}
