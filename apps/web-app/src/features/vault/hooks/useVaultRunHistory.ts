import { useQuery } from "@tanstack/react-query";
import type { ActionLogEntryRow } from "@/lib/jobs/types";

async function fetchVaultRunHistory(): Promise<ActionLogEntryRow[]> {
  const res = await fetch("/api/vault/history");
  if (!res.ok) throw new Error("Failed to fetch vault run history");
  return res.json();
}

export function useVaultRunHistory() {
  return useQuery<ActionLogEntryRow[]>({
    queryKey: ["vault", "invest-history"],
    queryFn: fetchVaultRunHistory,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}
