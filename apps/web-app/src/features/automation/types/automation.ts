export type StrategyPreset =
  | "conservative"
  | "balanced"
  | "aggressive"
  | "custom";
export type TriggerKind = "threshold" | "schedule" | "both";
export type StepStatus =
  | "pending"
  | "simulating"
  | "awaiting-signature"
  | "submitted"
  | "confirmed"
  | "failed";
export type VenueKind = "vault" | "pool" | "lending";

export interface AllocationConstraints {
  minPositionUsd: number;
  maxVenueCount: number;
  reserveBufferPct: number; // 0-100 keep idle
  perVenueCaps: Record<string, number>; // venueId -> max % of portfolio
  allowedAssets: string[]; // empty = all allowed
  deniedAssets: string[];
}

export interface RiskGuards {
  stopLossPct: number; // exit if portfolio drops X%
  takeProfitPct: number; // realize gains at X%
  minHealthFactor: number; // for leveraged venues
}

export interface StrategyRule {
  trigger: TriggerKind;
  improvementThresholdBps: number; // min net-APY gain in basis points to rebalance
  scheduleIntervalMs: number; // for schedule/both trigger
  slippageTolerancePct: number;
  constraints: AllocationConstraints;
  guards: RiskGuards;
  autoExecute: boolean; // skip confirmation step
}

export interface Strategy {
  id: string;
  name: string;
  preset: StrategyPreset;
  rule: StrategyRule;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
}

export interface VenueCandidate {
  id: string;
  kind: VenueKind;
  name: string;
  asset: string;
  grossApyBps: number;
  borrowCostBps: number;
  protocolFeeBps: number;
  amortizedGasBps: number;
  netApyBps: number; // derived: gross - borrowCost - fees - gas
  availableLiquidityUsd: number;
  currentAllocationPct: number;
}

export interface AllocationTarget {
  venueId: string;
  targetPct: number;
  deltaUsd: number; // positive = deposit, negative = withdraw
}

export interface RebalancePlan {
  id: string;
  strategyId: string;
  createdAt: number;
  triggerReason: string;
  currentBlendedNetApyBps: number;
  proposedBlendedNetApyBps: number;
  improvementBps: number;
  estimatedSlippageBps: number;
  estimatedFeeUsd: number;
  estimatedGasUsd: number;
  projectedEarningsDeltaUsd: { d30: number; d90: number; d365: number };
  targets: AllocationTarget[];
  steps: ExecutionStep[];
  status:
    | "draft"
    | "confirmed"
    | "executing"
    | "completed"
    | "failed"
    | "aborted";
}

export interface ExecutionStep {
  id: string;
  planId: string;
  index: number;
  kind: "withdraw" | "swap" | "deposit";
  venueId: string;
  asset: string;
  amountUsd: number;
  status: StepStatus;
  txHash?: string;
  error?: string;
  retryCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ActionLogEntry {
  id: string;
  strategyId: string;
  strategyName: string;
  planId?: string;
  timestamp: number;
  triggerReason: string;
  candidatesConsidered: number;
  proposedNetApyBps: number;
  realizedNetApyBps?: number;
  estimatedSlippageBps: number;
  actualSlippageBps?: number;
  estimatedFeeUsd: number;
  actualFeeUsd?: number;
  txHashes: string[];
  outcome: "executed" | "simulated" | "skipped" | "failed" | "aborted";
  notes?: string;
}

export interface SimulationResult {
  plan: RebalancePlan;
  candidates: VenueCandidate[];
  skippedReason?: string;
}
