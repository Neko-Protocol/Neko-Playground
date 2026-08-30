import { useQuery } from "@tanstack/react-query";
import type { ActionLogEntry } from "../types/automation";
import { STRATEGY_QUERY_KEYS } from "../const/automation";

async function fetchHistory(
  walletAddress: string,
  strategyId?: string
): Promise<ActionLogEntry[]> {
  const params = new URLSearchParams({ walletAddress });
  if (strategyId) params.set("strategyId", strategyId);
  const res = await fetch(`/api/automation/history?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export function useActionLog(
  walletAddress: string | undefined,
  strategyId?: string
) {
  return useQuery<ActionLogEntry[]>({
    queryKey: [...STRATEGY_QUERY_KEYS.history, walletAddress, strategyId],
    queryFn: () => fetchHistory(walletAddress!, strategyId),
    enabled: !!walletAddress,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}

export function exportToCsv(entries: ActionLogEntry[]): void {
  const headers = [
    "Timestamp",
    "Strategy",
    "Trigger",
    "Candidates",
    "Proposed Net APY (bps)",
    "Realized Net APY (bps)",
    "Est. Slippage (bps)",
    "Actual Slippage (bps)",
    "Est. Fee (USD)",
    "Actual Fee (USD)",
    "Tx Hashes",
    "Outcome",
    "Notes",
  ];

  const rows = entries.map((e) => [
    new Date(e.timestamp).toISOString(),
    e.strategyName,
    e.triggerReason,
    e.candidatesConsidered,
    e.proposedNetApyBps,
    e.realizedNetApyBps ?? "",
    e.estimatedSlippageBps,
    e.actualSlippageBps ?? "",
    e.estimatedFeeUsd.toFixed(4),
    e.actualFeeUsd?.toFixed(4) ?? "",
    e.txHashes.join("|"),
    e.outcome,
    e.notes ?? "",
  ]);

  const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `automation-log-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
