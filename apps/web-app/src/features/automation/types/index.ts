/**
 * Smart Yield Router — automated capital allocation engine.
 *
 * Rules-driven engine that automatically moves capital across
 * vaults, pools, and lending positions based on user-defined strategies.
 */

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type AllocationAction = "deposit" | "withdraw" | "rebalance" | "claim";

export interface YieldStrategy {
  id: string;
  name: string;
  riskProfile: RiskProfile;
  targetAllocations: AllocationTarget[];
  rebalanceThreshold: number; // percentage deviation that triggers rebalance
  autoCompound: boolean;
  createdAt: number;
  updatedAt: number;
  active: boolean;
}

export interface AllocationTarget {
  protocol: string;
  poolId: string;
  targetWeight: number; // 0-100 percentage
  currentWeight: number;
  apy: number;
  tvl: number;
  chain: string;
}

export interface RouterPosition {
  protocol: string;
  poolId: string;
  chain: string;
  amount: bigint;
  valueUsd: number;
  apy: number;
  entryTimestamp: number;
  lastHarvestTimestamp: number;
  pendingRewards: bigint;
}

export interface RouterEvent {
  id: string;
  strategyId: string;
  action: AllocationAction;
  protocol: string;
  poolId: string;
  amount: bigint;
  txHash: string;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
  gasUsed?: bigint;
}

export interface RouterStats {
  totalValueLocked: number;
  totalYieldEarned: number;
  averageApy: number;
  positionsCount: number;
  strategiesActive: number;
  lastRebalanceTimestamp: number;
  events24h: number;
}

export interface YieldOpportunity {
  protocol: string;
  poolId: string;
  chain: string;
  apy: number;
  tvl: number;
  riskScore: number; // 0-100, lower = safer
  type: "vault" | "pool" | "lending" | "staking";
  token: string;
  estimatedDailyYield: number;
}
