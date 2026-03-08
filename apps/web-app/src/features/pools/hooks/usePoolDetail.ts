"use client";

import { useMemo } from "react";
import { usePoolInfo } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { formatLiquidity } from "../utils/poolUtils";
import type { PoolDetailView } from "../types/pools";

export type PoolDetailData = PoolInfo & PoolDetailView;

export function usePoolDetail(contractId: string | undefined) {
  const query = usePoolInfo(contractId);
  const { data: pool } = query;

  const data: PoolDetailData | undefined = useMemo(() => {
    if (!pool) return undefined;

    const token1 = pool.tokens[0]?.code ?? "?";
    const token2 =
      pool.tokens.length > 1
        ? (pool.tokens[1]?.code ??
          (pool.type === "blend" || pool.type === "neko" ? "Lending" : "?"))
        : pool.type === "blend" || pool.type === "neko"
          ? "Lending"
          : "?";

    const decimals = pool.tokens[0]?.decimals ?? 7;
    const tvlFormatted = formatLiquidity(
      fromSmallestUnit(pool.tvl.toString(), decimals)
    );
    const apyFormatted = pool.apy > 0 ? `${pool.apy.toFixed(2)}%` : "0.00%";
    const typeLabel =
      pool.type === "blend" || pool.type === "neko"
        ? "Lending"
        : pool.type === "soroswap"
          ? "AMM"
          : pool.type;

    return {
      ...pool,
      token1,
      token2,
      tvlFormatted,
      apyFormatted,
      typeLabel,
    };
  }, [pool]);

  return {
    ...query,
    data,
  };
}
