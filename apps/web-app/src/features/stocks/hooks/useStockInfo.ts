import { useMemo } from "react";
import { useOracleRWAMetadata } from "./useOracleRWAMetadata";
import { STOCK_INFO } from "../utils/stockInfo";
import type { StockInfo } from "../types/stocks";
import type { RWAMetadata } from "@neko/oracle";

/**
 * Resolve display info for an asset: prefer oracle RWA metadata when available,
 * otherwise fall back to the static STOCK_INFO map. Adding a new asset in the
 * oracle does not require a code change when metadata is set on-chain.
 */
export function useStockInfo(symbol: string): StockInfo | undefined {
  const symbolUpper = symbol?.toUpperCase() ?? "";
  const { metadata } = useOracleRWAMetadata(symbolUpper);

  return useMemo((): StockInfo | undefined => {
    if (metadata) {
      return rwaMetadataToStockInfo(metadata);
    }
    return STOCK_INFO[symbolUpper];
  }, [metadata, symbolUpper]);
}

function rwaMetadataToStockInfo(m: RWAMetadata): StockInfo {
  const logoEntry = m.metadata?.find(
    ([key]) => key.toLowerCase() === "logo" || key.toLowerCase() === "image_url"
  );
  const logo = logoEntry?.[1] ?? "/placeholder.svg";
  return {
    name: m.name ?? m.asset_id,
    description: m.description ?? "",
    logo,
  };
}
