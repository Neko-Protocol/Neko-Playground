import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Strategy } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";

async function fetchStrategies(): Promise<Strategy[]> {
  const res = await fetch("/api/automation/strategies");
  if (!res.ok) throw new Error("Failed to fetch strategies");
  return res.json();
}

export function useStrategies() {
  return useQuery<Strategy[]>({
    queryKey: STRATEGY_QUERY_KEYS.list,
    queryFn: fetchStrategies,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}

export function useCreateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      strategy: Omit<Strategy, "id" | "createdAt" | "updatedAt">
    ) => {
      const res = await fetch("/api/automation/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strategy),
      });
      if (!res.ok) throw new Error("Failed to create strategy");
      return res.json() as Promise<Strategy>;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: STRATEGY_QUERY_KEYS.list }),
  });
}

export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: Partial<Strategy> & { id: string }) => {
      const res = await fetch(`/api/automation/strategies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update strategy");
      return res.json() as Promise<Strategy>;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: STRATEGY_QUERY_KEYS.list }),
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/automation/strategies/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete strategy");
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: STRATEGY_QUERY_KEYS.list }),
  });
}
