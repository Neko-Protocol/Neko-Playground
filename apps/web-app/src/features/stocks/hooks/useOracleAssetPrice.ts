import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import oracleClient from "@/lib/clients/oracle";
import type { Asset } from "@neko/oracle";
import { formatAsset } from "../utils/oracleUtils";

export const useOracleAssetPrice = (asset: Asset) => {
  const assetStr = formatAsset(asset);

  // Fetch oracle decimals
  const { data: decimals } = useQuery({
    queryKey: ["oracle", "decimals"],
    queryFn: async () => {
      const result = await oracleClient.decimals();
      return result.result;
    },
    staleTime: Infinity, // Decimals don't change
  });

  const { data: lastPrice, isLoading: isLoadingPrice } = useQuery({
    queryKey: ["oracle", "lastprice", assetStr],
    queryFn: async () => {
      const result = await oracleClient.lastprice({ asset });
      return result.result;
    },
  });

  const { data: priceHistory } = useQuery({
    queryKey: ["oracle", "prices", assetStr],
    queryFn: async () => {
      const result = await oracleClient.prices({ asset, records: 10 });
      return result.result;
    },
  });

  // Memoized helper function to convert price from oracle format to human-readable
  const decimalPlaces = decimals ?? 14;
  const formatPrice = useCallback(
    (price: bigint | number): number => {
      const priceNum = typeof price === "bigint" ? Number(price) : price;
      return priceNum / Math.pow(10, decimalPlaces);
    },
    [decimalPlaces]
  );

  return {
    lastPrice,
    priceHistory,
    isLoadingPrice,
    assetStr,
    decimals: decimalPlaces,
    formatPrice,
  };
};
