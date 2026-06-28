"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import type { NavHistoryApiResponse, TimeWindow } from "../types/analytics";

async function fetchNavHistory(
  address: string,
  window: TimeWindow
): Promise<NavHistoryApiResponse> {
  const res = await fetch(
    `/api/analytics/nav-history?address=${encodeURIComponent(address)}&window=${window}`
  );
  if (!res.ok) throw new Error("Failed to fetch NAV history");
  return res.json();
}

export function useNavHistory(window: TimeWindow) {
  const { address } = useWallet();

  return useQuery({
    queryKey: ["analytics-nav-history", address, window],
    queryFn: () => fetchNavHistory(address!, window),
    enabled: !!address,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    placeholderData: (prev) => prev,
    throwOnError: false,
  });
}
