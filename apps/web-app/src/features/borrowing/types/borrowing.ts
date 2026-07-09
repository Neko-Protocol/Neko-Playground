import type { PoolState } from "@/lib/orchestrator/types/pool.types";

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
  state: PoolState;
  contractId: string;
}

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
  state: PoolState;
  assetCode: string;
  collateralTokenCode: string;
  collateralFactor: number;
  contractId: string;
  isAggregated?: boolean;
  orchestratorId?: string;
}

export interface BorrowExecutionParams {
  collateralTokenCode: string;
  assetCode: string;
  collateralAmount: string;
  borrowAmount: string;
  collateralDecimals?: number;
  borrowDecimals?: number;
  contractId: string;
}

export interface BorrowFormState {
  collateralAmount: string;
  borrowAmount: string;
}
