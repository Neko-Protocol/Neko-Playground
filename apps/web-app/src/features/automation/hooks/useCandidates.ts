import { useQuery } from "@tanstack/react-query";
import type { VenueCandidate } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";

async function fetchCandidates(
  strategyId: string,
  walletAddress: string
): Promise<VenueCandidate[]> {
  const params = new URLSearchParams({
    strategyId,
    walletAddress,
  });
  const res = await fetch(`/api/automation/candidates?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch candidates");
  return res.json();
}

export function useCandidates(
  strategyId: string | undefined,
  walletAddress: string | undefined
) {
  return useQuery<VenueCandidate[]>({
    queryKey: STRATEGY_QUERY_KEYS.candidates(strategyId ?? ""),
    queryFn: () => fetchCandidates(strategyId!, walletAddress!),
    enabled: !!strategyId && !!walletAddress,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}
