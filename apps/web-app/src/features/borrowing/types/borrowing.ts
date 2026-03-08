/**
 * Shared types for the borrowing feature
 */

/** Pool data from the RWA lending contract (useBorrowPools) */
export interface BorrowPool {
  asset: string;
  assetCode: string;
  collateralToken: string;
  collateralTokenCode: string;
  collateralFactor: number;
  interestRate: number;
  poolBalance: string;
  poolBalanceUSD: string;
  isActive: boolean;
  contractId: string;
}

/** Row shape for the borrow table (derived from BorrowPool) */
export interface BorrowTableAsset {
  id: string;
  pool: {
    token1: string;
    token2: string;
    fee: string;
  };
  borrowApr: string;
  collateralFactorDisplay: string;
  liquidity: string;
  isActive: boolean;
  assetCode: string;
  collateralTokenCode: string;
  collateralFactor: number;
  contractId: string;
}

/** Params for executing the borrow flow (approve → addCollateral → borrow) */
export interface BorrowExecutionParams {
  collateralTokenCode: string;
  assetCode: string;
  collateralAmount: string;
  borrowAmount: string;
  collateralDecimals?: number;
  borrowDecimals?: number;
  contractId: string;
}

/** Form state for the borrow modal */
export interface BorrowFormState {
  collateralAmount: string;
  borrowAmount: string;
}
