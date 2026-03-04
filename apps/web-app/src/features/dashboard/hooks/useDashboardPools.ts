import { useMemo } from "react";
import { usePools } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import type { AssetData } from "@/features/dashboard/types/dashboard";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { formatLiquidity } from "@/lib/helpers/formatUtils";

const DASHBOARD_POOL_LIMIT = 3;

interface UseDashboardPoolsResult {
  assets: AssetData[];
  isLoading: boolean;
  error: Error | null;
}

export function useDashboardPools(): UseDashboardPoolsResult {
  const { data: allPools = [], isLoading, error } = usePools();

  const assets = useMemo<AssetData[]>(() => {
    return allPools.slice(0, DASHBOARD_POOL_LIMIT).map((pool: PoolInfo) => {
      const token1 = pool.tokens[0]?.code ?? "?";
      const token2 =
        pool.tokens.length > 1
          ? (pool.tokens[1]?.code ?? "?")
          : pool.type === "blend" || pool.type === "neko"
            ? "Lending"
            : "?";

      const decimals = pool.tokens[0]?.decimals ?? 7;
      const liquidity = formatLiquidity(
        fromSmallestUnit(pool.tvl.toString(), decimals),
      );

      const apy = pool.apy > 0 ? `${pool.apy.toFixed(2)}%` : "0.00%";

      return {
        id: pool.id,
        pool: { token1, token2, fee: "0%" },
        roi: apy,
        feeApy: apy,
        liquidity,
        isActive: pool.state === "active",
        type: pool.type,
      };
    });
  }, [allPools]);

  return {
    assets,
    isLoading,
    error: error as Error | null,
  };
}
