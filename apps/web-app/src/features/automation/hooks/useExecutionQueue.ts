import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RebalancePlan } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";
import { useActivityStore } from "@/stores/activityStore";

async function fetchQueue(
  strategyId: string,
  walletAddress: string
): Promise<RebalancePlan[]> {
  const res = await fetch(
    `/api/automation/execute?strategyId=${strategyId}&walletAddress=${walletAddress}`
  );
  if (!res.ok) throw new Error("Failed to fetch execution queue");
  return res.json();
}

export function useExecutionQueue(
  strategyId: string | undefined,
  walletAddress: string | undefined
) {
  return useQuery<RebalancePlan[]>({
    queryKey: STRATEGY_QUERY_KEYS.queue(strategyId ?? ""),
    queryFn: () => fetchQueue(strategyId!, walletAddress!),
    enabled: !!strategyId && !!walletAddress,
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}

export function useConfirmPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      plan,
      walletAddress,
      strategyName,
    }: {
      plan: RebalancePlan;
      walletAddress: string;
      strategyName?: string;
    }) => {
      const res = await fetch("/api/automation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          walletAddress,
          strategyName,
          action: "confirm",
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to confirm plan");
      }
      return res.json() as Promise<RebalancePlan>;
    },
    onSuccess: (_data, { plan }) => {
      useActivityStore.getState().pushEvent({
        source: "automation",
        type: "plan-confirmed",
        timestamp: Date.now(),
        summary: "Strategy execution plan confirmed",
        link: "/automation",
      });
      qc.invalidateQueries({
        queryKey: STRATEGY_QUERY_KEYS.queue(plan.strategyId),
      });
      qc.invalidateQueries({
        queryKey: STRATEGY_QUERY_KEYS.simulate(plan.strategyId),
      });
      qc.invalidateQueries({ queryKey: STRATEGY_QUERY_KEYS.history });
    },
  });
}

export function useCancelPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      walletAddress,
    }: {
      planId: string;
      strategyId: string;
      walletAddress: string;
    }) => {
      const res = await fetch("/api/automation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, walletAddress, action: "cancel" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to cancel plan");
      }
    },
    onSuccess: (_data, { strategyId }) => {
      useActivityStore.getState().pushEvent({
        source: "automation",
        type: "plan-cancelled",
        timestamp: Date.now(),
        summary: "Strategy execution plan cancelled",
        link: "/automation",
      });
      qc.invalidateQueries({ queryKey: STRATEGY_QUERY_KEYS.queue(strategyId) });
    },
  });
}
