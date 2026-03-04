"use client";

import { useMemo, useState, useCallback } from "react";
import { usePools } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { formatLiquidity } from "../utils/poolUtils";
import type { PoolCardData } from "../types/pools";

export type PoolTypeFilter = "all" | "lending" | "amm";

function isLendingPoolType(type: string): boolean {
  return type === "blend" || type === "neko";
}

function matchesTypeFilter(poolType: string, filter: PoolTypeFilter): boolean {
  if (filter === "all") return true;
  if (filter === "lending") return isLendingPoolType(poolType);
  if (filter === "amm") return poolType === "soroswap";
  return true;
}

/**
 * Fetches all pools and maps them to PoolCardData for the list/card view.
 * Supports filtering by pool type and searching by token name.
 */
export function usePoolsData() {
  const { data: allPools = [], isLoading, error } = usePools();
  const [typeFilter, setTypeFilter] = useState<PoolTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSetTypeFilter = useCallback((f: PoolTypeFilter) => {
    setTypeFilter(f);
  }, []);

  const handleSetSearchQuery = useCallback((q: string) => {
    setSearchQuery(q);
  }, []);

  const pools: PoolCardData[] = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    return allPools
      .filter((pool: PoolInfo) => matchesTypeFilter(pool.type, typeFilter))
      .filter((pool: PoolInfo) => {
        if (!query) return true;
        const tokenNames = pool.tokens.map((t) => t.code.toLowerCase());
        return (
          tokenNames.some((n) => n.includes(query)) ||
          pool.name.toLowerCase().includes(query)
        );
      })
      .map((pool: PoolInfo) => {
        const token1 = pool.tokens[0]?.code ?? "?";
        const token2 =
          pool.tokens.length > 1
            ? (pool.tokens[1]?.code ?? "?")
            : pool.type === "blend"
              ? "Lending"
              : "?";

        const decimals = pool.tokens[0]?.decimals ?? 7;
        const liquidity = formatLiquidity(
          fromSmallestUnit(pool.tvl.toString(), decimals),
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
  }, [allPools, typeFilter, searchQuery]);

  return {
    pools,
    isLoading,
    error,
    typeFilter,
    setTypeFilter: handleSetTypeFilter,
    searchQuery,
    setSearchQuery: handleSetSearchQuery,
  };
}
