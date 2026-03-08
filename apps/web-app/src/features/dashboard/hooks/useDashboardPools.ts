import { useMemo } from "react";
import { usePools } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import type { PoolData } from "@/features/lending/types/lending";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { formatLiquidity } from "@/lib/helpers/formatUtils";

interface UseDashboardPoolsResult {
  assets: PoolData[];
  isLoading: boolean;
  error: Error | null;
}

export function useDashboardPools(): UseDashboardPoolsResult {
  const { data: allPools = [], isLoading, error } = usePools();

  const assets = useMemo<PoolData[]>(() => {
    return allPools
      .filter((pool: PoolInfo) => pool.supportedActions.includes("deposit"))
      .slice(0, 4)
      .map((pool: PoolInfo): PoolData => {
        const token1 = pool.tokens[0]?.code ?? "?";
        const token2 =
          pool.tokens.length > 1 ? (pool.tokens[1]?.code ?? "?") : "Lending";

        const decimals = pool.tokens[0]?.decimals ?? 7;
        const liquidity = formatLiquidity(
          fromSmallestUnit(pool.tvl.toString(), decimals)
        );

        const apy = pool.apy > 0 ? `${pool.apy.toFixed(2)}%` : "0.00%";

        return {
          id: pool.id,
          name: pool.name,
          token1,
          token2,
          fee: "0%",
          roi: apy,
          feeApy: apy,
          liquidity,
          isActive: pool.state === "active",
          assetCode: token1,
          asset: token1,
          contractId: pool.id,
          isAggregated: pool.type !== "neko",
          orchestratorId: pool.id,
        };
      });
  }, [allPools]);

  return {
    assets,
    isLoading,
    error: error as Error | null,
  };
}
