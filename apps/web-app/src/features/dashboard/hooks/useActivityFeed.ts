"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAccountActivity } from "@/lib/services/activity.service";
import type { ActivityEntry } from "@/features/dashboard/types/activity";

export function useActivityFeed(address?: string) {
  return useQuery<ActivityEntry[]>({
    queryKey: ["account-activity", address],
    queryFn: () => (address ? fetchAccountActivity(address) : Promise.resolve([])),
    enabled: !!address,
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 15000,
  });
}
