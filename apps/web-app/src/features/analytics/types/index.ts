export interface PositionSnapshot {
  timestamp: number;
  protocol: string;
  poolId: string;
  chain: string;
  amount: bigint;
  valueUsd: number;
  apy: number;
  yieldEarned: number;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  totalYieldEarned: number;
  averageApy: number;
  positionsCount: number;
  bestPerforming: { protocol: string; poolId: string; apy: number } | null;
  worstPerforming: { protocol: string; poolId: string; apy: number } | null;
}

export interface YieldBreakdown {
  protocol: string;
  chain: string;
  valueUsd: number;
  yieldAnnual: number;
  percentage: number;
  color: string;
}

export interface RiskExposure {
  protocol: string;
  chain: string;
  valueUsd: number;
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  concentration: number;
}

export interface PerformanceDataPoint {
  date: number;
  totalValue: number;
  yieldEarned: number;
  apy: number;
}

export interface AnalyticsFilters {
  chain: string;
  protocol: string;
  timeRange: "7d" | "30d" | "90d" | "all";
}
