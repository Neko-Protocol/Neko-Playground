"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  PositionSnapshot,
  PortfolioSummary,
  YieldBreakdown,
  RiskExposure,
  PerformanceDataPoint,
  AnalyticsFilters,
} from "../types";

/**
 * Analytics engine for portfolio earnings and DeFi performance tracking.
 * Aggregates positions, computes yield breakdowns, risk exposure, and performance trends.
 */
export function usePortfolioAnalytics() {
  const [positions, setPositions] = useState<PositionSnapshot[]>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    chain: "all",
    protocol: "all",
    timeRange: "30d",
  });

  const filteredPositions = useMemo(() => {
    let result = positions;
    if (filters.chain !== "all") {
      result = result.filter((p: PositionSnapshot) => p.chain === filters.chain);
    }
    if (filters.protocol !== "all") {
      result = result.filter((p: PositionSnapshot) => p.protocol === filters.protocol);
    }
    if (filters.timeRange !== "all") {
      const now = Date.now();
      const rangeMs: Record<string, number> = { "7d": 604800000, "30d": 2592000000, "90d": 7776000000 };
      const cutoff = now - (rangeMs[filters.timeRange] || 0);
      result = result.filter((p: PositionSnapshot) => p.timestamp > cutoff);
    }
    return result;
  }, [positions, filters]);

  const summary: PortfolioSummary = useMemo(() => {
    if (filteredPositions.length === 0) {
      return { totalValueUsd: 0, totalYieldEarned: 0, averageApy: 0, positionsCount: 0, bestPerforming: null, worstPerforming: null };
    }
    const totalValueUsd = filteredPositions.reduce((s: number, p: PositionSnapshot) => s + p.valueUsd, 0);
    const totalYieldEarned = filteredPositions.reduce((s: number, p: PositionSnapshot) => s + p.yieldEarned, 0);
    const averageApy = filteredPositions.reduce((s: number, p: PositionSnapshot) => s + p.apy * p.valueUsd, 0) / (totalValueUsd || 1);
    const sorted = [...filteredPositions].sort((a: PositionSnapshot, b: PositionSnapshot) => b.apy - a.apy);
    return {
      totalValueUsd,
      totalYieldEarned,
      averageApy,
      positionsCount: filteredPositions.length,
      bestPerforming: sorted[0] ? { protocol: sorted[0].protocol, poolId: sorted[0].poolId, apy: sorted[0].apy } : null,
      worstPerforming: sorted[sorted.length - 1] ? { protocol: sorted[sorted.length - 1].protocol, poolId: sorted[sorted.length - 1].poolId, apy: sorted[sorted.length - 1].apy } : null,
    };
  }, [filteredPositions]);

  const yieldBreakdown: YieldBreakdown[] = useMemo(() => {
    const byProtocol: Record<string, { value: number; yield: number }> = {};
    const colors = ["#6366f1", "#8b5cf6", "#a78bfa", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#ec4899"];
    let idx = 0;
    for (const p of filteredPositions) {
      if (!byProtocol[p.protocol]) byProtocol[p.protocol] = { value: 0, yield: 0 };
      byProtocol[p.protocol].value += p.valueUsd;
      byProtocol[p.protocol].yield += p.yieldEarned;
    }
    const totalValue = Object.values(byProtocol).reduce((s: number, v: { value: number; yield: number }) => s + v.value, 0) || 1;
    return Object.entries(byProtocol).map(([protocol, data]: [string, { value: number; yield: number }]) => ({
      protocol,
      chain: "multi",
      valueUsd: data.value,
      yieldAnnual: data.yield,
      percentage: (data.value / totalValue) * 100,
      color: colors[idx++ % colors.length],
    }));
  }, [filteredPositions]);

  const riskExposure: RiskExposure[] = useMemo(() => {
    const byProtocol: Record<string, { value: number; chain: string }> = {};
    for (const p of filteredPositions) {
      if (!byProtocol[p.protocol]) byProtocol[p.protocol] = { value: 0, chain: p.chain };
      byProtocol[p.protocol].value += p.valueUsd;
    }
    const totalValue = Object.values(byProtocol).reduce((s: number, v: { value: number; chain: string }) => s + v.value, 0) || 1;
    return Object.entries(byProtocol).map(([protocol, data]: [string, { value: number; chain: string }]) => {
      const concentration = (data.value / totalValue) * 100;
      const riskScore = Math.min(100, concentration * 1.5);
      return {
        protocol,
        chain: data.chain,
        valueUsd: data.value,
        riskScore,
        riskLevel: riskScore < 30 ? "low" : riskScore < 60 ? "medium" : "high",
        concentration,
      };
    });
  }, [filteredPositions]);

  const performanceHistory: PerformanceDataPoint[] = useMemo(() => {
    if (filteredPositions.length === 0) return [];
    const sorted = [...filteredPositions].sort((a: PositionSnapshot, b: PositionSnapshot) => a.timestamp - b.timestamp);
    const points: PerformanceDataPoint[] = [];
    let cumulativeYield = 0;
    for (const p of sorted) {
      cumulativeYield += p.yieldEarned;
      points.push({
        date: p.timestamp,
        totalValue: p.valueUsd,
        yieldEarned: cumulativeYield,
        apy: p.apy,
      });
    }
    return points;
  }, [filteredPositions]);

  const setFilter = useCallback((key: keyof AnalyticsFilters, value: string) => {
    setFilters((prev: AnalyticsFilters) => ({ ...prev, [key]: value }));
  }, []);

  return {
    positions,
    setPositions,
    filters,
    setFilter,
    filteredPositions,
    summary,
    yieldBreakdown,
    riskExposure,
    performanceHistory,
  };
}
