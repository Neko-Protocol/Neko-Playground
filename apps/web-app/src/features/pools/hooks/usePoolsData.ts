"use client";

import { useMemo } from "react";
import { usePools } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { formatLiquidity } from "../utils/poolUtils";
import type { PoolCardData } from "../types/pools";

/**
 * Fetches all pools and maps them to PoolCardData for the list/card view.
 * Uses stable pool.id from the orchestrator.
 */
export function usePoolsData() {
  const { data: allPools = [], isLoading, error } = usePools();

  const pools: PoolCardData[] = useMemo(() => {
    return allPools.map((pool: PoolInfo) => {
      const token1 = pool.tokens[0]?.code ?? "?";
      const token2 =
        pool.tokens.length > 1
          ? (pool.tokens[1]?.code ?? "?")
          : pool.type === "blend"
            ? "Lending"
            : "?";

      const decimals = pool.tokens[0]?.decimals ?? 7;
      const liquidity = formatLiquidity(
        fromSmallestUnit(pool.tvl.toString(), decimals)
      );

      const apy = pool.apy > 0 ? `${pool.apy.toFixed(2)}%` : "0.00%";

      return {
        id: pool.id,
        token1,
        token2,
        fee: "0%",
        roi: apy,
        feeApy: apy,
        liquidity,
        isActive: pool.state === "active",
        type: pool.type,
      };
    });
  }, [allPools]);

  return { pools, isLoading, error };
}
