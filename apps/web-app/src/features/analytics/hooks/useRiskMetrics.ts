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

    // Fewer than 2 real snapshots means no return can be computed yet —
    // surface that honestly instead of falling back to a fabricated ratio.
    if (!nav?.series || nav.series.length < 2) {
      return serverRisk
        ? { ...serverRisk, sharpe: null, sortino: null, maxDrawdown: 0 }
        : serverRisk;
    }

    const navValues = nav.series.map((p) => p.nav);
    const returns = dailyReturns(navValues);
    const { maxDrawdown, maxDrawdownIndex } = computeDrawdown(navValues);
    const lastDrawdown = nav.series[nav.series.length - 1]?.drawdown ?? 0;

    // Same risk-score formula the server used to apply to synthetic
    // inputs — now fed the real HHI, borrow cost, drawdown and blended APY.
    const riskScore = Math.min(
      100,
      Math.round(
        (metrics && metrics.borrowCost > 0 ? 20 : 0) +
          ((metrics?.hhi ?? 0) / 100) * 0.3 +
          maxDrawdown * 2 +
          ((metrics?.blendedApy ?? 0) > 15 ? 15 : 0)
      )
    );

    return {
      sharpe: sharpeRatio(returns),
      sortino: sortinoRatio(returns),
      maxDrawdown,
      maxDrawdownDate: nav.series[maxDrawdownIndex]?.date ?? "—",
      currentDrawdown: lastDrawdown,
      healthFactor: serverRisk?.healthFactor ?? null,
      distanceToLiquidation: serverRisk?.distanceToLiquidation ?? null,
      riskScore,
    };
  }, [nav, metrics]);

  return { data, isLoading: navLoading || metricsLoading };
}
