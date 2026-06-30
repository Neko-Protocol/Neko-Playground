export type TimeWindow = "24h" | "7d" | "30d" | "ytd" | "all";

export type EarningsSourceId = "vault" | "lending" | "pools" | "rwa";

export interface EarningsSource {
  id: EarningsSourceId;
  label: string;
  earned: number;
  earnedPct: number;
}

export interface EarningsByAsset {
  asset: string;
  source: EarningsSourceId;
  earned: number;
}

export interface EarningsData {
  totalEarned: number;
  totalEarnedPct: number;
  sources: EarningsSource[];
  byAsset: EarningsByAsset[];
}

export interface NavPoint {
  date: string;
  nav: number;
  drawdown: number;
}

export interface AllocationEntry {
  label: string;
  value: number;
  pct: number;
}

export interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];
}

export interface PortfolioMetrics {
  totalValue: number;
  netApy: number;
  blendedApy: number;
  borrowCost: number;
  protocolFees: number;
  hhi: number;
  diversificationScore: number;
  allocationBySource: AllocationEntry[];
  correlationMatrix: CorrelationMatrix;
  cumulativeFees: number;
  cumulativeNetworkCosts: number;
}

export interface RiskMetrics {
  sharpe: number | null;
  sortino: number | null;
  maxDrawdown: number;
  maxDrawdownDate: string;
  currentDrawdown: number;
  healthFactor: number | null;
  distanceToLiquidation: number | null;
  riskScore: number;
}

export interface ILPosition {
  poolId: string;
  assets: [string, string];
  ilPct: number;
  ilUsd: number;
  hodlValue: number;
  currentValue: number;
}

export interface YieldForecast {
  days30: number;
  days90: number;
  days365: number;
  blendedApy: number;
}

export interface StressScenario {
  shockPct: number;
  newHealthFactor: number | null;
  portfolioLoss: number;
  isLiquidated: boolean;
}

export interface EarningsApiResponse extends EarningsData {
  window: TimeWindow;
  generatedAt: string;
}

export interface NavHistoryApiResponse {
  series: NavPoint[];
  window: TimeWindow;
  generatedAt: string;
}

export interface MetricsApiResponse extends PortfolioMetrics {
  riskMetrics: RiskMetrics;
  ilPositions: ILPosition[];
  yieldForecast: YieldForecast;
  generatedAt: string;
}
