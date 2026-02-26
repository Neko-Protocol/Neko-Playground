import { useMemo } from "react";
import { useLendingPools } from "@/features/lending/hooks/useLendingPools";
import { useBorrowPools } from "@/features/borrowing/hooks/useBorrowPools";
import type { AssetData } from "@/features/dashboard/types/dashboard";
import { formatLiquidity } from "@/features/dashboard/utils/dashboardUtils";

const DASHBOARD_POOL_LIMIT = 3;

interface UseDashboardPoolsResult {
  assets: AssetData[];
  isLoading: boolean;
  error: Error | null;
}

export function useDashboardPools(): UseDashboardPoolsResult {
  const {
    data: lendingPools = [],
    isLoading: isLoadingLending,
    error: lendingError,
  } = useLendingPools();

  const {
    data: borrowPools = [],
    isLoading: isLoadingBorrow,
    error: borrowError,
  } = useBorrowPools();

  const assets = useMemo<AssetData[]>(() => {
    const combined: AssetData[] = [];

    lendingPools.forEach((pool, index) => {
      const apy =
        pool.interestRate > 0 ? `${pool.interestRate.toFixed(2)}%` : "0.00%";

      combined.push({
        id: `lending-${index}`,
        pool: {
          token1: pool.assetCode,
          token2: "Lending",
          fee: "0%",
        },
        roi: `${pool.interestRate.toFixed(2)}%`,
        feeApy: apy,
        liquidity: formatLiquidity(pool.poolBalance),
        isActive: pool.isActive,
      });
    });

    borrowPools.forEach((pool, index) => {
      combined.push({
        id: `borrow-${index}`,
        pool: {
          token1: pool.assetCode,
          token2: pool.collateralTokenCode,
          fee: `${pool.collateralFactor}%`,
        },
        roi: `${pool.interestRate.toFixed(2)}%`,
        feeApy: `${pool.interestRate.toFixed(2)}%`,
        liquidity: formatLiquidity(pool.poolBalance),
        isActive: pool.isActive,
      });
    });

    return combined.slice(0, DASHBOARD_POOL_LIMIT);
  }, [lendingPools, borrowPools]);

  return {
    assets,
    isLoading: isLoadingLending || isLoadingBorrow,
    error: (lendingError ?? borrowError) as Error | null,
  };
}
