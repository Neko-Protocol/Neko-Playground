/**
 * Shared types for the lending feature
 */

/** Pool data from the RWA lending contract (useLendingPools) */
export interface LendingPool {
  asset: string;
  assetCode: string;
  poolBalance: string;
  interestRate: number;
  bTokenRate: string;
  isActive: boolean;
}

/** Pool display data for the Lend page UI */
export interface PoolData {
  id: string;
  name: string;
  token1: string;
  token2: string;
  fee: string;
  roi: string;
  feeApy: string;
  liquidity: string;
  isActive: boolean;
  assetCode: string;
  asset: string;
  bTokenRate?: string;
}

/** Params for executing a deposit (approve → deposit flow) */
export interface DepositParams {
  pool: PoolData;
  amount: string;
}

/** Params for executing a withdraw */
export interface WithdrawParams {
  pool: PoolData;
  bTokensToBurn: string;
}
