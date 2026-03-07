"use client";

import { useQuery } from "@tanstack/react-query";
import { orchestrator } from "../core/Orchestrator";
import type { PoolInfo, PoolPosition } from "../types/pool.types";

export const POOLS_QUERY_KEY = ["orchestrator", "pools"] as const;

export function usePools(enabled = true) {
  return useQuery<PoolInfo[]>({
    queryKey: [...POOLS_QUERY_KEY],
    queryFn: () => orchestrator.getAllPools(),
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 2,
    throwOnError: false,
    enabled,
  });
}

export function usePoolInfo(poolId: string | undefined) {
  return useQuery<PoolInfo>({
    queryKey: ["orchestrator", "pool", poolId],
    queryFn: () => orchestrator.getPoolInfo(poolId!),
    enabled: !!poolId,
    staleTime: 10_000,
    retry: 1,
    throwOnError: false,
  });
}

export function useUserPosition(
  poolId: string | undefined,
  userAddress: string | undefined
) {
  return useQuery<PoolPosition>({
    queryKey: ["orchestrator", "position", poolId, userAddress],
    queryFn: () => orchestrator.getUserPosition(poolId!, userAddress!),
    enabled: !!poolId && !!userAddress,
    staleTime: 10_000,
    retry: 1,
    throwOnError: false,
  });
}
