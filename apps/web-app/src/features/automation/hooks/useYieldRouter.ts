"use client";

import { useState, useCallback, useMemo } from "react";
import type {
  YieldStrategy,
  RouterPosition,
  RouterStats,
  RouterEvent,
  AllocationTarget,
} from "../types";

/**
 * Core hook for the Smart Yield Router engine.
 * Manages strategies, positions, rebalancing, and event history.
 */
export function useYieldRouter() {
  const [strategies, setStrategies] = useState<YieldStrategy[]>([]);
  const [positions, setPositions] = useState<RouterPosition[]>([]);
  const [events, setEvents] = useState<RouterEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const createStrategy = useCallback(
    (name: string, riskProfile: YieldStrategy["riskProfile"]): YieldStrategy => {
      const strategy: YieldStrategy = {
        id: "strat-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        name,
        riskProfile,
        targetAllocations: [],
        rebalanceThreshold: 5,
        autoCompound: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        active: true,
      };
      setStrategies((prev: YieldStrategy[]) => [...prev, strategy]);
      return strategy;
    },
    []
  );

  const addAllocation = useCallback(
    (strategyId: string, target: Omit<AllocationTarget, "currentWeight">) => {
      setStrategies((prev: YieldStrategy[]) =>
        prev.map((s: YieldStrategy) => {
          if (s.id !== strategyId) return s;
          const existing = s.targetAllocations.findIndex(
            (a: AllocationTarget) => a.protocol === target.protocol && a.poolId === target.poolId
          );
          const updated: AllocationTarget[] = [...s.targetAllocations];
          const withCurrent: AllocationTarget = { ...target, currentWeight: 0 };
          if (existing >= 0) {
            updated[existing] = withCurrent;
          } else {
            updated.push(withCurrent);
          }
          return { ...s, targetAllocations: updated, updatedAt: Date.now() };
        })
      );
    },
    []
  );

  const evaluateStrategies = useCallback((): {
    strategyId: string;
    strategyName: string;
    actions: { protocol: string; poolId: string; action: "increase" | "decrease"; deviation: number }[];
  }[] => {
    return strategies
      .filter((s: YieldStrategy) => s.active)
      .map((s: YieldStrategy) => {
        const actions: { protocol: string; poolId: string; action: "increase" | "decrease"; deviation: number }[] = [];
        for (const t of s.targetAllocations) {
          const deviation = t.currentWeight - t.targetWeight;
          if (Math.abs(deviation) < s.rebalanceThreshold) continue;
          actions.push({
            protocol: t.protocol,
            poolId: t.poolId,
            action: deviation > 0 ? "decrease" : "increase",
            deviation,
          });
        }
        return { strategyId: s.id, strategyName: s.name, actions };
      })
      .filter((r: { strategyId: string; strategyName: string; actions: { protocol: string; poolId: string; action: "increase" | "decrease"; deviation: number }[] }) => r.actions.length > 0);
  }, [strategies]);

  const simulateRebalance = useCallback(
    (strategyId: string): { expectedApyImprovement: number; estimatedGasUsd: number; steps: string[] } => {
      const strategy = strategies.find((s: YieldStrategy) => s.id === strategyId);
      if (!strategy) return { expectedApyImprovement: 0, estimatedGasUsd: 0, steps: [] };

      const steps: string[] = [];
      let apyImprovement = 0;

      for (const target of strategy.targetAllocations) {
        const deviation = target.currentWeight - target.targetWeight;
        if (Math.abs(deviation) < strategy.rebalanceThreshold) continue;

        if (deviation > 0) {
          steps.push("Withdraw " + deviation.toFixed(1) + "% from " + target.protocol + "/" + target.poolId + " (overweight)");
          apyImprovement += (deviation / 100) * (target.apy * 0.1);
        } else {
          steps.push("Deposit " + Math.abs(deviation).toFixed(1) + "% to " + target.protocol + "/" + target.poolId + " (underweight)");
          apyImprovement += (Math.abs(deviation) / 100) * (target.apy * 0.05);
        }
      }

      const estimatedGasUsd = steps.length * 2.5;
      return { expectedApyImprovement: apyImprovement, estimatedGasUsd, steps };
    },
    [strategies]
  );

  const stats: RouterStats = useMemo(() => {
    const totalValueLocked = positions.reduce((sum: number, p: RouterPosition) => sum + p.valueUsd, 0);
    const totalYieldEarned = events
      .filter((e: RouterEvent) => e.action === "claim" && e.status === "confirmed")
      .reduce((sum: number, e: RouterEvent) => sum + Number(e.amount), 0);
    const averageApy =
      positions.length > 0
        ? positions.reduce((sum: number, p: RouterPosition) => sum + p.apy * p.valueUsd, 0) / (totalValueLocked || 1)
        : 0;
    const dayAgo = Date.now() - 86400000;
    const events24h = events.filter((e: RouterEvent) => e.timestamp > dayAgo).length;
    const sorted = events
      .filter((e: RouterEvent) => e.action === "rebalance")
      .sort((a: RouterEvent, b: RouterEvent) => b.timestamp - a.timestamp);
    const lastRebalance = sorted[0];

    return {
      totalValueLocked,
      totalYieldEarned,
      averageApy,
      positionsCount: positions.length,
      strategiesActive: strategies.filter((s: YieldStrategy) => s.active).length,
      lastRebalanceTimestamp: lastRebalance?.timestamp ?? 0,
      events24h,
    };
  }, [positions, events, strategies]);

  return {
    strategies,
    positions,
    events,
    loading,
    stats,
    createStrategy,
    addAllocation,
    evaluateStrategies,
    simulateRebalance,
    setPositions,
    setEvents,
  };
}
