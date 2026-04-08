"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useVaultData } from "./useVaultData";

interface StrategyAllocation {
  strategy: string;
  amount: number;
}

interface InvestStatus {
  idle: number;
  total: number;
  canInvest: boolean;
  cooldownRemaining: number;
  allocations: StrategyAllocation[];
}

async function fetchInvestStatus(): Promise<InvestStatus> {
  const res = await fetch("/api/vault/invest");
  if (!res.ok) throw new Error("Failed to fetch invest status");
  return res.json();
}

export function useVaultInvest() {
  const [isInvesting, setIsInvesting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const { refetch: refetchVaultData } = useVaultData();

  const { data, refetch: refetchStatus } = useQuery({
    queryKey: ["vault-invest-status"],
    queryFn: fetchInvestStatus,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const triggerInvest = useCallback(async () => {
    if (isInvesting) return;
    setIsInvesting(true);
    setLastResult(null);

    try {
      const res = await fetch("/api/vault/invest", { method: "POST" });
      const json = await res.json();

      if (!res.ok && res.status !== 207) {
        setLastResult(`Error: ${json.error}`);
        return;
      }

      if (!json.invested) {
        setLastResult(json.message ?? "Nothing to invest");
        return;
      }

      const succeeded = (json.results as { status: string }[]).filter(
        (r) => r.status === "SUCCESS"
      ).length;
      const total = (json.results as unknown[]).length;
      setLastResult(`Invested across ${succeeded}/${total} strategies`);

      await Promise.all([refetchStatus(), refetchVaultData()]);
    } catch (err) {
      setLastResult(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setIsInvesting(false);
    }
  }, [isInvesting, refetchStatus, refetchVaultData]);

  return {
    idleAmount: data?.idle ?? 0,
    totalAmount: data?.total ?? 0,
    allocations: data?.allocations ?? [],
    canInvest: data?.canInvest ?? false,
    cooldownRemaining: data?.cooldownRemaining ?? 0,
    isInvesting,
    lastResult,
    triggerInvest,
  };
}
