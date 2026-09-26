import { useQuery } from "@tanstack/react-query";
import type { SimulationResult } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";

async function fetchSimulation(
  strategyId: string,
  walletAddress: string
): Promise<SimulationResult> {
  const params = new URLSearchParams({ strategyId, walletAddress });
  const res = await fetch(`/api/automation/simulate?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to simulate rebalance");
  return res.json();
}

export function useSimulateRebalance(
  strategyId: string | undefined,
  enabled = true,
  walletAddress?: string
) {
  return useQuery<SimulationResult>({
    queryKey: STRATEGY_QUERY_KEYS.simulate(strategyId ?? ""),
    queryFn: () => fetchSimulation(strategyId!, walletAddress!),
    enabled: enabled && !!strategyId && !!walletAddress,
    staleTime: 0,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}
