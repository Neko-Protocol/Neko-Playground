import type { StrategyRule, StrategyPreset } from "../types/automation";

export const DEFAULT_CONSTRAINTS = {
  minPositionUsd: 10,
  maxVenueCount: 5,
  reserveBufferPct: 5,
  perVenueCaps: {},
  allowedAssets: [],
  deniedAssets: [],
};

export const DEFAULT_GUARDS = {
  stopLossPct: 10,
  takeProfitPct: 50,
  minHealthFactor: 1.5,
};

const BASE_RULE: StrategyRule = {
  trigger: "threshold",
  improvementThresholdBps: 50,
  scheduleIntervalMs: 3_600_000,
  slippageTolerancePct: 1,
  constraints: DEFAULT_CONSTRAINTS,
  guards: DEFAULT_GUARDS,
  autoExecute: false,
};

export const PRESET_RULES: Record<StrategyPreset, StrategyRule> = {
  conservative: {
    ...BASE_RULE,
    improvementThresholdBps: 100,
    slippageTolerancePct: 0.5,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      maxVenueCount: 3,
      reserveBufferPct: 20,
    },
    guards: { stopLossPct: 5, takeProfitPct: 20, minHealthFactor: 2.0 },
  },
  balanced: {
    ...BASE_RULE,
    improvementThresholdBps: 50,
    slippageTolerancePct: 1,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      maxVenueCount: 5,
      reserveBufferPct: 10,
    },
    guards: DEFAULT_GUARDS,
  },
  aggressive: {
    ...BASE_RULE,
    improvementThresholdBps: 20,
    slippageTolerancePct: 2,
    constraints: {
      ...DEFAULT_CONSTRAINTS,
      maxVenueCount: 8,
      reserveBufferPct: 2,
    },
    guards: { stopLossPct: 20, takeProfitPct: 100, minHealthFactor: 1.2 },
  },
  custom: BASE_RULE,
};

export const PRESET_LABELS: Record<StrategyPreset, string> = {
  conservative: "Conservative",
  balanced: "Balanced",
  aggressive: "Aggressive",
  custom: "Custom",
};

export const PRESET_DESCRIPTIONS: Record<StrategyPreset, string> = {
  conservative: "Low risk, high improvement threshold, large reserve buffer.",
  balanced: "Moderate risk, balanced thresholds. Good starting point.",
  aggressive: "High activity, small threshold, minimal reserve. Higher risk.",
  custom: "Define your own rules.",
};

export const STRATEGY_QUERY_KEYS = {
  list: ["automation", "strategies"] as const,
  candidates: (strategyId: string) =>
    ["automation", "candidates", strategyId] as const,
  simulate: (strategyId: string) =>
    ["automation", "simulate", strategyId] as const,
  queue: (strategyId: string) => ["automation", "queue", strategyId] as const,
  history: ["automation", "history"] as const,
};
