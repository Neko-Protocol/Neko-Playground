/**
 * Pure helpers for the lending feature: formatting and calculations
 */

import { formatLiquidity } from "@/lib/helpers/formatUtils";
import type { LendingPool, PoolData } from "../types/lending";

/**
 * Calculate the number of bTokens needed to withdraw a given token amount.
 * Formula: bTokens = tokens / bTokenRate
 * (bTokenRate is already in human-readable format with 9 decimals applied)
 */
export function calculateBTokensFromTokens(
  tokensAmount: string,
  bTokenRate: string
): string {
  if (
    !tokensAmount ||
    parseFloat(tokensAmount) <= 0 ||
    !bTokenRate ||
    parseFloat(bTokenRate) <= 0
  ) {
    return "0";
  }

  const tokens = parseFloat(tokensAmount);
  const rate = parseFloat(bTokenRate);
  const bTokens = tokens / rate;

  return bTokens.toFixed(7);
}

/**
 * Map lending pools from the contract to PoolData display objects for the UI.
 */
export function poolsToPoolData(lendingPools: LendingPool[]): PoolData[] {
  return lendingPools.map((pool, index) => {
    const apy =
      pool.interestRate > 0 ? `${pool.interestRate.toFixed(2)}%` : "0.00%";
    const liquidity = formatLiquidity(pool.poolBalance);

    return {
      id: `pool-${index}`,
      name: `${pool.assetCode} Pool`,
      token1: pool.assetCode,
      token2: "",
      fee: "0%",
      roi: `${pool.interestRate.toFixed(2)}%`,
      feeApy: apy,
      liquidity,
      isActive: pool.isActive,
      assetCode: pool.assetCode,
      asset: pool.asset,
      bTokenRate: pool.bTokenRate,
    };
  });
}
