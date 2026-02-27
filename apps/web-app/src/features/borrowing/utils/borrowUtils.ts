/**
 * Pure helpers for borrowing: formatting, calculations
 */

import type { BorrowPool, BorrowTableAsset } from "../types/borrowing";

/** Format pool balance for display (e.g. $1.5k, $2.00M) */
export function formatLiquidityDisplay(balanceNum: number): string {
  if (balanceNum >= 1_000_000) {
    return `$${(balanceNum / 1_000_000).toFixed(2)}M`;
  }
  if (balanceNum >= 1000) {
    return `$${(balanceNum / 1000).toFixed(2)}k`;
  }
  return `$${balanceNum.toFixed(2)}`;
}

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
    const balanceNum = parseFloat(pool.poolBalance);
    const liquidity = formatLiquidityDisplay(balanceNum);
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
