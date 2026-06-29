"use client";

import { useQueries } from "@tanstack/react-query";
import { networks } from "@neko/lending";
import { lendingService } from "@/lib/services/lending.service";

// Re-export from the single source of truth so existing consumers keep working.
export {
  getHealthFactorColor,
  getHealthFactorLabel,
} from "../const/riskThresholds";

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
