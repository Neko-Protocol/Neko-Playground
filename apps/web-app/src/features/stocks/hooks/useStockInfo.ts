import { useMemo } from "react";
import { useOracleRWAMetadata } from "./useOracleRWAMetadata";
import { STOCK_INFO } from "../utils/stockInfo";
import type { StockInfo } from "../types/stocks";
import type { RWAMetadata } from "@neko/oracle";

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
  const logo = logoEntry?.[1] ?? "/assets/xlm-logo.png";
  return {
    name: m.name ?? m.asset_id,
    description: m.description ?? "",
    logo,
  };
}
