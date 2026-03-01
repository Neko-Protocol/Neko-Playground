/**
 * Lending feature types
 * Shared between Lend page, useLendingPools, and related components
 */

/** Raw pool data from the RWA lending contract (useLendingPools) */
export interface LendingPool {
  asset: string;
  assetCode: string;
  poolBalance: string;
  interestRate: number;
  bTokenRate: string;
  isActive: boolean;
}

/** UI-facing pool data for Lend page (dropdown, stats, modals) */
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
