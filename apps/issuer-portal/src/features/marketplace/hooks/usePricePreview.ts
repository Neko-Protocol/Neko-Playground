"use client";

import { useQuery } from "@tanstack/react-query";
import {
  applyPricingNormalization,
  simulateOraclePrice,
  stroopsFromXlm,
} from "@/lib/stellar/contract";
import { useWallet } from "@/hooks/useWallet";
import type { ListedAsset } from "@/types";

export interface PricePreview {
  /** Stroops per token base unit (i128 in the contract). */
  pricePerTokenStroops: bigint;
  /** Same value expressed as XLM for display. */
  pricePerTokenXlm: number;
  /** True if the price comes from a live oracle simulation. */
  live: boolean;
  /** Unix seconds when the oracle reported the price (oracle only). */
  oracleTimestamp?: number;
}

/**
 * Resolve the effective price of a listing.
 *  - Fixed pricing → derive from the listing record (no network call).
 *  - Oracle pricing → simulate the configured Reflector method and apply
 *                      the listing's premium/discount.
 *
 * Oracle prices auto-refetch every 30s (with a window of 30s staleness).
 */
export function usePricePreview(asset: ListedAsset | null) {
  const { address } = useWallet();

  return useQuery<PricePreview | null>({
    enabled: !!asset,
    queryKey: [
      "price-preview",
      asset?.contractId,
      asset?.pricing.type === "oracle" ? asset.pricing.oracleContract : "fixed",
      asset?.pricing.type === "oracle"
        ? `${asset.pricing.method}:${JSON.stringify(asset.pricing.base)}:${JSON.stringify(
            asset.pricing.quote
          )}:${asset.pricing.premiumBps}`
        : asset?.pricing.type === "fixed"
          ? asset.pricing.priceXlm
          : null,
    ],
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!asset) return null;
      if (asset.pricing.type === "fixed") {
        const stroops = stroopsFromXlm(asset.pricing.priceXlm);
        return {
          pricePerTokenStroops: stroops,
          pricePerTokenXlm: asset.pricing.priceXlm,
          live: false,
        };
      }
      if (!address) return null;
      const sample = await simulateOraclePrice(
        address,
        asset.pricing.oracleContract,
        asset.pricing.method,
        asset.pricing.base,
        asset.pricing.quote
      );
      if (!sample) return null;
      const stroops = applyPricingNormalization(
        sample.price,
        sample.decimals,
        asset.pricing.premiumBps
      );
      return {
        pricePerTokenStroops: stroops,
        pricePerTokenXlm: Number(stroops) / 10_000_000,
        live: true,
        oracleTimestamp: sample.timestamp,
      };
    },
  });
}
