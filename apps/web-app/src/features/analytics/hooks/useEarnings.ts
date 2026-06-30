"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import type { EarningsApiResponse, TimeWindow } from "../types/analytics";

async function fetchEarnings(
  address: string,
  window: TimeWindow
): Promise<EarningsApiResponse> {
  const res = await fetch(
    `/api/analytics/earnings?address=${encodeURIComponent(address)}&window=${window}`
  );
  if (!res.ok) throw new Error("Failed to fetch earnings");
  return res.json();
}

export function useEarnings(window: TimeWindow) {
  const { address } = useWallet();

  return useQuery({
    queryKey: ["analytics-earnings", address, window],
    queryFn: () => fetchEarnings(address!, window),
    enabled: !!address,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
    throwOnError: false,
  });
}
