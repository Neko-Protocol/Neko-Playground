export interface AssetData {
  id: string;
  pool: {
    token1: string;
    token2: string;
    fee: string;
  };
  roi: string;
  feeApy: string;
  liquidity: string;
  isActive: boolean;
  type: string;
}
