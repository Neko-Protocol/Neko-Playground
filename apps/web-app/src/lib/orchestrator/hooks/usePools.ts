"use client";

/**
 * usePools — React Query hook that fetches **all** pools from every
 * registered adapter via the Orchestrator singleton.
 *
 * Drop-in replacement for the old `useLendingPools` + `useBorrowPools`
 * pattern used in the Pools page.
 */

import { useQuery } from "@tanstack/react-query";
import { orchestrator } from "../core/Orchestrator";
import type { PoolInfo, PoolPosition } from "../types/pool.types";

export const POOLS_QUERY_KEY = ["orchestrator", "pools"] as const;

/**
 * Fetch all pools across adapters.
 *
 * @param enabled - Pass `false` to disable the query (e.g. while wallet is loading).
 */
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

/**
 * Fetch a single pool by its full id (e.g. `blend:USDC`).
 */
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

/**
 * Fetch the connected user's position in a pool (deposited amount, rewards).
 * Returns null when wallet is not connected.
 */
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
