import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { RebalancePlan } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";

async function fetchQueue(strategyId: string): Promise<RebalancePlan[]> {
  const res = await fetch(`/api/automation/execute?strategyId=${strategyId}`);
  if (!res.ok) throw new Error("Failed to fetch execution queue");
  return res.json();
}

export function useExecutionQueue(strategyId: string | undefined) {
  return useQuery<RebalancePlan[]>({
    queryKey: STRATEGY_QUERY_KEYS.queue(strategyId ?? ""),
    queryFn: () => fetchQueue(strategyId!),
    enabled: !!strategyId,
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
      planId,
      strategyId,
    }: {
      planId: string;
      strategyId: string;
    }) => {
      const res = await fetch("/api/automation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, strategyId, action: "confirm" }),
      });
      if (!res.ok) throw new Error("Failed to confirm plan");
      return res.json() as Promise<RebalancePlan>;
    },
    onSuccess: (_data, { strategyId }) => {
      qc.invalidateQueries({ queryKey: STRATEGY_QUERY_KEYS.queue(strategyId) });
      qc.invalidateQueries({
        queryKey: STRATEGY_QUERY_KEYS.simulate(strategyId),
      });
    },
  });
}

export function useCancelPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      planId,
      strategyId,
    }: {
      planId: string;
      strategyId: string;
    }) => {
      const res = await fetch("/api/automation/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, strategyId, action: "cancel" }),
      });
      if (!res.ok) throw new Error("Failed to cancel plan");
    },
    onSuccess: (_data, { strategyId }) => {
      qc.invalidateQueries({ queryKey: STRATEGY_QUERY_KEYS.queue(strategyId) });
    },
  });
}
