import { useQueries } from "@tanstack/react-query";
import { usePools } from "@/lib/orchestrator/hooks/usePools";
import { orchestrator } from "@/lib/orchestrator/core/Orchestrator";
import { useWallet } from "@/hooks/useWallet";
import type { PoolPosition, PoolInfo } from "@/lib/orchestrator/types/pool.types";

export interface UserPositionWithPool {
  pool: PoolInfo;
  position: PoolPosition;
}

export function useUserPositions() {
  const { address } = useWallet();
  const { data: pools = [], isLoading: isLoadingPools } = usePools();

  const positionQueries = useQueries({
    queries: pools.map((pool) => ({
      queryKey: ["orchestrator", "position", pool.id, address],
      queryFn: () => orchestrator.getUserPosition(pool.id, address!),
      enabled: Boolean(address) && pools.length > 0,
      staleTime: 15_000,
      retry: 1,
    })),
  });

  const isLoading =
    isLoadingPools || positionQueries.some((q) => q.isLoading);

  const positions: UserPositionWithPool[] = [];
  positionQueries.forEach((q, i) => {
    if (q.data && q.data.deposited > 0n) {
      positions.push({ pool: pools[i], position: q.data });
    }
  });

  return { positions, isLoading, hasWallet: Boolean(address) };
}
