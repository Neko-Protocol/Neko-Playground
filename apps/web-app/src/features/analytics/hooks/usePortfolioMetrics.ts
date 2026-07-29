"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useUnifiedPositions } from "@/features/dashboard/hooks/useUnifiedPositions";
import { useHealthFactor } from "@/features/borrowing/hooks/useHealthFactor";
import type { UnifiedPosition } from "@/features/dashboard/positions/types";
import { hhi, diversificationScore } from "../utils/concentration";
import { blendedApy, netApy, projectEarnings } from "../utils/apy";
import { buildAllocationBySource } from "../utils/allocation";
import type { MetricsApiResponse } from "../types/analytics";

/** Priced positions in a direction that carry a known APY, in the {apy, valueUsd} shape `blendedApy` expects. */
function toApyWeighted(
  positions: UnifiedPosition[],
  direction: UnifiedPosition["direction"]
): { apy: number; valueUsd: number }[] {
  const result: { apy: number; valueUsd: number }[] = [];
  for (const p of positions) {
    if (
      p.direction === direction &&
      p.valueUsd !== null &&
      p.valueUsd > 0 &&
      typeof p.apy === "number"
    ) {
      result.push({ apy: p.apy, valueUsd: p.valueUsd });
    }
  }
  return result;
}

async function fetchMetrics(address: string): Promise<MetricsApiResponse> {
  const res = await fetch(
    `/api/analytics/metrics?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) throw new Error("Failed to fetch portfolio metrics");
  return res.json();
}

/**
 * The analytics API route only has server-side reach — no wallet context —
 * so it estimates totalValue/allocation from raw Horizon balances with flat
 * price multipliers, and never sees lending, borrowing, vault or backstop
 * positions at all. Real per-protocol data lives client-side in the unified
 * position engine (same source the dashboard's portfolio total uses), so
 * this hook overrides the server's totalValue/allocation/hhi/health-factor
 * with it once it has loaded.
 *
 * blendedApy/borrowCost/netApy are recomputed the same way, weighting each
 * position's own APY (already carried on `UnifiedPosition.apy`) by its real
 * USD size — replacing the server's fixed per-protocol APY assumptions. The
 * yield forecast is re-projected from that real blended APY too, though a
 * forecast is inherently a projection, not a historical fact — it stays
 * labeled "Modeled" in the UI regardless of how real its inputs are.
 *
 * What stays server-derived: the correlation matrix (needs a real
 * historical *price* series per asset, not just a portfolio total) and IL
 * positions. Those need data this app doesn't collect yet — a separate,
 * larger piece of work — so they remain clearly labeled as estimates
 * instead of being half-patched with more guesses. NAV history, and the
 * Sharpe/Sortino/drawdown derived from it, come from `useNavHistory`, which
 * now reads real persisted snapshots (see `usePortfolioHistory`).
 */
export function usePortfolioMetrics() {
  const { address } = useWallet();
  const portfolio = useUnifiedPositions();
  const { pools: healthFactors } = useHealthFactor(address);

  const query = useQuery({
    queryKey: ["analytics-metrics", address],
    queryFn: () => fetchMetrics(address!),
    enabled: !!address,
    staleTime: 3 * 60_000,
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
    throwOnError: false,
  });

  const data = useMemo<MetricsApiResponse | undefined>(() => {
    if (!query.data || portfolio.isLoading) return query.data;

    const allocationBySource = buildAllocationBySource(portfolio.positions);
    const hhiValue = hhi(allocationBySource.map((a) => a.value));

    const activeHealthFactors = healthFactors
      .map((p) => p.healthFactor)
      .filter((hf): hf is number => hf !== null && Number.isFinite(hf));
    const healthFactor =
      activeHealthFactors.length > 0 ? Math.min(...activeHealthFactors) : null;
    const distanceToLiquidation =
      healthFactor != null ? ((healthFactor - 1.0) / healthFactor) * 100 : null;

    const realBlendedApy = blendedApy(
      toApyWeighted(portfolio.positions, "asset")
    );
    const realBorrowCost = blendedApy(
      toApyWeighted(portfolio.positions, "liability")
    );
    const realNetApy = netApy(realBlendedApy, realBorrowCost);

    return {
      ...query.data,
      totalValue: portfolio.totalValueUsd,
      allocationBySource,
      hhi: parseFloat(hhiValue.toFixed(0)),
      diversificationScore: diversificationScore(hhiValue),
      blendedApy: parseFloat(realBlendedApy.toFixed(2)),
      borrowCost: parseFloat(realBorrowCost.toFixed(2)),
      netApy: parseFloat(realNetApy.toFixed(2)),
      yieldForecast: {
        days30: parseFloat(
          projectEarnings(portfolio.totalValueUsd, realBlendedApy, 30).toFixed(
            2
          )
        ),
        days90: parseFloat(
          projectEarnings(portfolio.totalValueUsd, realBlendedApy, 90).toFixed(
            2
          )
        ),
        days365: parseFloat(
          projectEarnings(portfolio.totalValueUsd, realBlendedApy, 365).toFixed(
            2
          )
        ),
        blendedApy: parseFloat(realBlendedApy.toFixed(2)),
      },
      riskMetrics: {
        ...query.data.riskMetrics,
        healthFactor,
        distanceToLiquidation:
          distanceToLiquidation != null
            ? parseFloat(distanceToLiquidation.toFixed(2))
            : null,
      },
    };
  }, [query.data, portfolio, healthFactors]);

  return { ...query, data };
}
