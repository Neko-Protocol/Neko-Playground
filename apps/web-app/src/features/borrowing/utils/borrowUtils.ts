/**
 * Pure helpers for borrowing: formatting, calculations
 */

import { formatLiquidity } from "@/lib/helpers/formatUtils";
import type { BorrowPool, BorrowTableAsset } from "../types/borrowing";

/** Borrow limit from collateral amount and collateral factor (percentage, e.g. 75) */
export function calculateBorrowLimit(
  collateralAmount: number,
  collateralFactorPct: number
): number {
  if (!Number.isFinite(collateralAmount) || collateralAmount <= 0) {
    return 0;
  }
  return collateralAmount * (collateralFactorPct / 100);
}

/**
 * Map borrow pools to table row assets (id, pool, borrowApr, liquidity, etc.)
 */
export function poolsToTableAssets(pools: BorrowPool[]): BorrowTableAsset[] {
  return pools.map((pool, index) => {
    const liquidity = formatLiquidity(pool.poolBalance);
    return {
      id: `borrow-${index}`,
      pool: {
        token1: pool.assetCode,
        token2: pool.collateralTokenCode,
        fee: `${pool.collateralFactor}%`,
      },
      borrowApr: `${pool.interestRate.toFixed(2)}%`,
      collateralFactorDisplay: `${pool.collateralFactor}%`,
      liquidity,
      isActive: pool.isActive,
      assetCode: pool.assetCode,
      collateralTokenCode: pool.collateralTokenCode,
      collateralFactor: pool.collateralFactor,
    };
  });
}
