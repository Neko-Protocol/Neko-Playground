import { useQuery } from "@tanstack/react-query";
import type { SimulationResult } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";

async function fetchSimulation(strategyId: string): Promise<SimulationResult> {
  const res = await fetch(`/api/automation/simulate?strategyId=${strategyId}`);
  if (!res.ok) throw new Error("Failed to simulate rebalance");
  return res.json();
}

export function useSimulateRebalance(
  strategyId: string | undefined,
  enabled = false
) {
  return useQuery<SimulationResult>({
    queryKey: STRATEGY_QUERY_KEYS.simulate(strategyId ?? ""),
    queryFn: () => fetchSimulation(strategyId!),
    enabled: !!strategyId && enabled,
    staleTime: 0,
    gcTime: 2 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}
