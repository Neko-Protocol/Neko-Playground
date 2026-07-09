import type { PoolState } from "@/lib/orchestrator/types/pool.types";

export interface PoolCardData {
  id: string;
  token1: string;
  token2: string;
  fee: string;
  roi: string;
  feeApy: string;
  liquidity: string;
  isActive: boolean;
  state: PoolState;
  type: string;
}

export interface PoolDetailView {
  token1: string;
  token2: string;
  tvlFormatted: string;
  apyFormatted: string;
  typeLabel: string;
}
