import { formatLiquidity } from "@/lib/helpers/formatUtils";
import type { BorrowPool, BorrowTableAsset } from "../types/borrowing";

export function calculateBorrowLimit(
  collateralAmount: number,
  collateralFactorPct: number
): number {
  if (!Number.isFinite(collateralAmount) || collateralAmount <= 0) {
    return 0;
  }
  return collateralAmount * (collateralFactorPct / 100);
}

export function poolsToTableAssets(pools: BorrowPool[]): BorrowTableAsset[] {
  return pools.map((pool, index) => {
    const liquidity = formatLiquidity(pool.poolBalance);
    return {
      id: `borrow-${index}`,
      pool: {
        token1: pool.assetCode,
        token2: pool.collateralTokenCode,
        fee: "V1",
      },
      borrowApr: `${pool.interestRate.toFixed(2)}%`,
      collateralFactorDisplay: `${pool.collateralFactor}%`,
      liquidity,
      isActive: pool.isActive,
      state: pool.state,
      assetCode: pool.assetCode,
      collateralTokenCode: pool.collateralTokenCode,
      collateralFactor: pool.collateralFactor,
      contractId: pool.contractId,
    };
  });
}
