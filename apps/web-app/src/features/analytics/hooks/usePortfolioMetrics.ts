"use client";

import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import type { MetricsApiResponse } from "../types/analytics";

async function fetchMetrics(address: string): Promise<MetricsApiResponse> {
  const res = await fetch(
    `/api/analytics/metrics?address=${encodeURIComponent(address)}`
  );
  if (!res.ok) throw new Error("Failed to fetch portfolio metrics");
  return res.json();
}

export function usePortfolioMetrics() {
  const { address } = useWallet();

  return useQuery({
    queryKey: ["analytics-metrics", address],
    queryFn: () => fetchMetrics(address!),
    enabled: !!address,
    staleTime: 3 * 60_000,
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
    throwOnError: false,
  });
}
