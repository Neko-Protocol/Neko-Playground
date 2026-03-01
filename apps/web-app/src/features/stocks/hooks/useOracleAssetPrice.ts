import { useQuery } from "@tanstack/react-query";
import oracleClient from "@/lib/clients/oracle";
import type { Asset } from "@neko/oracle";
import { formatAsset } from "../utils/oracleUtils";
import {
  PRICE_HISTORY_RECORDS,
  ORACLE_PRICE_STALE_MS,
  ORACLE_DECIMALS_STALE_MS,
  ORACLE_DECIMALS,
} from "../constants/oracle";

export interface UseOracleAssetPriceOptions {
  /** When provided, uses this value instead of fetching decimals (avoids duplicate query). */
  decimals?: number;
}

export const useOracleAssetPrice = (
  asset: Asset,
  options: UseOracleAssetPriceOptions = {}
) => {
  const assetStr = formatAsset(asset);
  const { decimals: decimalsParam } = options;

  // Use shared cache: same queryKey as useOracle. Only fetch when decimals not passed in.
  const { data: decimalsFromCache } = useQuery({
    queryKey: ["oracle", "decimals"],
    queryFn: async () => {
      const result = await oracleClient.decimals();
      return result.result;
    },
    staleTime: ORACLE_DECIMALS_STALE_MS,
    enabled: decimalsParam === undefined,
  });

  const decimals = decimalsParam ?? decimalsFromCache ?? ORACLE_DECIMALS;

  const {
    data: lastPrice,
    isLoading: isLoadingPrice,
    error: lastPriceError,
  } = useQuery({
    queryKey: ["oracle", "lastprice", assetStr],
    queryFn: async () => {
      const result = await oracleClient.lastprice({ asset });
      return result.result;
    },
    staleTime: ORACLE_PRICE_STALE_MS,
  });

  const { data: priceHistory, error: priceHistoryError } = useQuery({
    queryKey: ["oracle", "prices", assetStr],
    queryFn: async () => {
      const result = await oracleClient.prices({
        asset,
        records: PRICE_HISTORY_RECORDS,
      });
      return result.result;
    },
    staleTime: ORACLE_PRICE_STALE_MS,
  });

  const error = lastPriceError ?? priceHistoryError;

  return {
    lastPrice,
    priceHistory,
    isLoadingPrice,
    assetStr,
    decimals,
    error,
  };
};
