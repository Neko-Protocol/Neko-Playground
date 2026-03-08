"use client";

import { useQueries } from "@tanstack/react-query";
import { networks } from "@neko/lending";
import { lendingService } from "@/lib/services/lending.service";

export function getHealthFactorColor(hf: number | null): string {
  if (hf === null) return "text-white/40";
  if (hf >= 1.5) return "text-green-400";
  if (hf >= 1.0) return "text-yellow-400";
  return "text-red-400";
}

export function getHealthFactorLabel(hf: number | null): string {
  if (hf === null) return "No Position";
  if (hf >= 1.5) return "Safe";
  if (hf >= 1.0) return "Caution";
  return "At Risk";
}

const POOLS = [
  {
    key: "pool1",
    contractId: networks.testnet.pool1ContractId,
    label: "Pool 1",
  },
  {
    key: "pool2",
    contractId: networks.testnet.pool2ContractId,
    label: "Pool 2",
  },
] as const;

export interface PoolHealthFactor {
  key: string;
  label: string;
  contractId: string;
  healthFactor: number | null;
}

export function useHealthFactor(borrower: string | undefined) {
  const results = useQueries({
    queries: POOLS.map((pool) => ({
      queryKey: ["health-factor", pool.key, borrower],
      queryFn: () => lendingService.getHealthFactor(borrower!, pool.contractId),
      enabled: Boolean(borrower),
      staleTime: 15_000,
      refetchInterval: 15_000,
    })),
  });

  const pools: PoolHealthFactor[] = POOLS.map((pool, i) => ({
    key: pool.key,
    label: pool.label,
    contractId: pool.contractId,
    healthFactor: results[i].data ?? null,
  }));

  const isLoading = results.some((r) => r.isLoading);

  return { pools, isLoading };
}
