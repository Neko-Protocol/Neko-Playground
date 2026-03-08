export interface PoolCardData {
  id: string;
  token1: string;
  token2: string;
  fee: string;
  roi: string;
  feeApy: string;
  liquidity: string;
  isActive: boolean;
  type: string;
}

export interface PoolDetailView {
  token1: string;
  token2: string;
  tvlFormatted: string;
  apyFormatted: string;
  typeLabel: string;
}
