import type { PoolState } from "@/lib/orchestrator/types/pool.types";

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
  state: PoolState;
  assetCode: string;
  asset: string;
  bTokenRate?: string;
  contractId: string;
  isAggregated?: boolean;
  orchestratorId?: string;
}
