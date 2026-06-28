"use client";

import { useMemo } from "react";
import { useNavHistory } from "./useNavHistory";
import { usePortfolioMetrics } from "./usePortfolioMetrics";
import { dailyReturns, sharpeRatio, sortinoRatio } from "../utils/riskRatios";
import { computeDrawdown } from "../utils/drawdown";
import type { TimeWindow, RiskMetrics } from "../types/analytics";

export function useRiskMetrics(window: TimeWindow): {
  data: RiskMetrics | null;
  isLoading: boolean;
} {
  const { data: nav, isLoading: navLoading } = useNavHistory(window);
  const { data: metrics, isLoading: metricsLoading } = usePortfolioMetrics();

  const data = useMemo<RiskMetrics | null>(() => {
    const serverRisk = metrics?.riskMetrics ?? null;

    if (!nav?.series || nav.series.length < 2) {
      return serverRisk;
    }

    const navValues = nav.series.map((p) => p.nav);
    const returns = dailyReturns(navValues);
    const { maxDrawdown, maxDrawdownIndex } = computeDrawdown(navValues);
    const lastDrawdown = nav.series[nav.series.length - 1]?.drawdown ?? 0;

    return {
      sharpe: sharpeRatio(returns) ?? serverRisk?.sharpe ?? null,
      sortino: sortinoRatio(returns) ?? serverRisk?.sortino ?? null,
      maxDrawdown,
      maxDrawdownDate: nav.series[maxDrawdownIndex]?.date ?? "—",
      currentDrawdown: lastDrawdown,
      healthFactor: serverRisk?.healthFactor ?? null,
      distanceToLiquidation: serverRisk?.distanceToLiquidation ?? null,
      riskScore: serverRisk?.riskScore ?? 50,
    };
  }, [nav, metrics]);

  return { data, isLoading: navLoading || metricsLoading };
}
