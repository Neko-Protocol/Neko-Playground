"use client";

import { useQuery } from "@tanstack/react-query";

interface StrategyApy {
  name: string;
  apy: number | null;
  weight: number;
}

interface VaultApyData {
  vaultApy: number | null;
  strategies: StrategyApy[];
  note?: string;
}

async function fetchVaultApy(): Promise<VaultApyData> {
  const res = await fetch("/api/vault/apy");
  if (!res.ok) throw new Error("Failed to fetch APY");
  return res.json();
}

export function useVaultApy() {
  return useQuery({
    queryKey: ["vault-apy"],
    queryFn: fetchVaultApy,
    staleTime: 5 * 60_000, // 5 min — rates don't change that fast
    refetchInterval: 10 * 60_000, // refresh every 10 min
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });
}
