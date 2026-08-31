"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePools } from "@/lib/orchestrator/hooks/usePools";
import { getQuote, getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { stellarPriceService } from "@/lib/services/stellar-price.service";
import { getAssetsConfig } from "@/lib/constants/assets.config";
import {
  deriveRouteCandidates,
  selectRoute,
} from "@/lib/strategy/leverage/routing";
import type { PoolInfo } from "@/lib/orchestrator/types/pool.types";
import type { RouteResult, SwapQuoteFn } from "@/lib/strategy/leverage/types";

export const DEFAULT_LEVERAGE_BORROW_ASSET = "USDC";

export interface UseLeverageBuilderInput {
  assetCode: string;
  borrowAssetCode?: string;
  initialCollateralAmount: string;
  targetMultiple: number;
  safetyBufferPct: number;
}

function matchesAsset(pool: PoolInfo, assetCode: string): boolean {
  return pool.tokens.some((t) => t.code === assetCode);
}

/**
 * Resolves getQuote() a real, addressable pair — the pre-trade route
 * simulation calls the real Soroswap on-chain quote path (unlike the
 * strategy step it will eventually generate, which follows the existing
 * codebase's asset-code convention for swap params — see
 * lib/strategy/leverage/buildStrategy.ts's comment on that mismatch), so it
 * needs actual contract addresses.
 */
function makeSwapQuoteFn(): SwapQuoteFn {
  const tokens = getAvailableTokens();
  return async ({ tokenIn, tokenOut, amountIn }) => {
    const assetIn = tokens[tokenIn]?.contract;
    const assetOut = tokens[tokenOut]?.contract;
    if (!assetIn || !assetOut) return null;
    try {
      const quote = await getQuote({
        assetIn,
        assetOut,
        amount: amountIn,
        tradeType: "EXACT_IN",
      });
      if (!quote) return null;
      const priceImpactBps = Math.round(
        parseFloat(quote.priceImpact ?? "0") * 100
      );
      return {
        amountOut: quote.amountOut,
        priceImpactBps: Number.isFinite(priceImpactBps) ? priceImpactBps : 0,
      };
    } catch {
      return null;
    }
  };
}

export const LEVERAGE_ROUTE_QUERY_KEY = "leverage-builder-route";

/**
 * Scope §1-2's builder: evaluates every registered pool (blend/neko) that
 * can supply the required collateral/borrow legs for the chosen asset, and
 * produces the routed loop plan + pre-trade simulation for the composer UI
 * to confirm before any step executes.
 */
export function useLeverageBuilder(input: UseLeverageBuilderInput | null) {
  const enabled = Boolean(
    input &&
    input.assetCode &&
    Number(input.initialCollateralAmount) > 0 &&
    input.targetMultiple > 1
  );
  const { data: pools = [], isLoading: poolsLoading } = usePools(enabled);
  const assetsConfig = getAssetsConfig();
  const borrowAssetCode =
    input?.borrowAssetCode ?? DEFAULT_LEVERAGE_BORROW_ASSET;

  const priceQuery = useQuery({
    queryKey: ["leverage-builder-price", input?.assetCode],
    queryFn: () =>
      stellarPriceService.getPrice(
        input!.assetCode,
        assetsConfig[input!.assetCode]?.contract
      ),
    enabled: Boolean(input?.assetCode),
    staleTime: 15_000,
  });

  const routeQuery = useQuery<RouteResult>({
    queryKey: [
      LEVERAGE_ROUTE_QUERY_KEY,
      input?.assetCode,
      borrowAssetCode,
      input?.initialCollateralAmount,
      input?.targetMultiple,
      input?.safetyBufferPct,
      pools.length,
    ],
    queryFn: async () => {
      const collateralPools = pools.filter((p) =>
        matchesAsset(p, input!.assetCode)
      );
      const borrowPools = pools.filter((p) => matchesAsset(p, borrowAssetCode));
      const candidates = deriveRouteCandidates(collateralPools, borrowPools);

      return selectRoute({
        assetCode: input!.assetCode,
        borrowAssetCode,
        initialCollateralAmount: input!.initialCollateralAmount,
        targetMultiple: input!.targetMultiple,
        safetyBufferPct: input!.safetyBufferPct,
        candidates,
        getSwapQuote: makeSwapQuoteFn(),
        priceUsd: priceQuery.data ?? null,
      });
    },
    enabled: enabled && pools.length > 0,
    staleTime: 10_000,
    retry: false,
    throwOnError: false,
  });

  const candidatePoolCount = useMemo(
    () =>
      pools.filter(
        (p) =>
          matchesAsset(p, input?.assetCode ?? "") ||
          matchesAsset(p, borrowAssetCode)
      ).length,
    [pools, input?.assetCode, borrowAssetCode]
  );

  return {
    borrowAssetCode,
    route: routeQuery.data,
    isLoading: poolsLoading || routeQuery.isFetching,
    error: routeQuery.error,
    candidatePoolCount,
  };
}
