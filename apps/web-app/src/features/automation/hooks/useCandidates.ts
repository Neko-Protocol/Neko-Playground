import { useQuery } from "@tanstack/react-query";
import type { VenueCandidate } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";

async function fetchCandidates(strategyId: string): Promise<VenueCandidate[]> {
  const res = await fetch(
    `/api/automation/candidates?strategyId=${strategyId}`
  );
  if (!res.ok) throw new Error("Failed to fetch candidates");
  return res.json();
}

export function useCandidates(strategyId: string | undefined) {
  return useQuery<VenueCandidate[]>({
    queryKey: STRATEGY_QUERY_KEYS.candidates(strategyId ?? ""),
    queryFn: () => fetchCandidates(strategyId!),
    enabled: !!strategyId,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}
