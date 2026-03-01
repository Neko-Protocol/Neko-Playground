import { useQuery } from "@tanstack/react-query";
import oracleClient from "@/lib/clients/oracle";
import {
  ORACLE_PRICE_STALE_MS,
  ORACLE_DECIMALS_STALE_MS,
} from "../constants/oracle";

export const useOracle = () => {
  const {
    data: assets,
    isLoading: isLoadingAssets,
    error: assetsError,
  } = useQuery({
    queryKey: ["oracle", "assets"],
    queryFn: async () => {
      const result = await oracleClient.assets();
      return result.result;
    },
    staleTime: ORACLE_PRICE_STALE_MS,
  });

  const {
    data: baseAsset,
    isLoading: isLoadingBase,
    error: baseError,
  } = useQuery({
    queryKey: ["oracle", "base"],
    queryFn: async () => {
      const result = await oracleClient.base();
      return result.result;
    },
    staleTime: ORACLE_PRICE_STALE_MS,
  });

  const {
    data: decimals,
    isLoading: isLoadingDecimals,
    error: decimalsError,
  } = useQuery({
    queryKey: ["oracle", "decimals"],
    queryFn: async () => {
      const result = await oracleClient.decimals();
      return result.result;
    },
    staleTime: ORACLE_DECIMALS_STALE_MS,
  });

  const {
    data: resolution,
    isLoading: isLoadingResolution,
    error: resolutionError,
  } = useQuery({
    queryKey: ["oracle", "resolution"],
    queryFn: async () => {
      const result = await oracleClient.resolution();
      return result.result;
    },
    staleTime: ORACLE_PRICE_STALE_MS,
  });

  const {
    data: rwaAssets,
    isLoading: isLoadingRWAAssets,
    error: rwaAssetsError,
  } = useQuery({
    queryKey: ["oracle", "rwa-assets"],
    queryFn: async () => {
      const result = await oracleClient.get_all_rwa_assets();
      return result.result;
    },
    enabled: !!assets,
    staleTime: ORACLE_PRICE_STALE_MS,
  });

  const isLoading =
    isLoadingAssets ||
    isLoadingBase ||
    isLoadingDecimals ||
    isLoadingResolution ||
    isLoadingRWAAssets;

  const error =
    assetsError ??
    baseError ??
    decimalsError ??
    resolutionError ??
    rwaAssetsError;

  return {
    assets,
    baseAsset,
    decimals,
    resolution,
    rwaAssets,
    isLoading,
    isLoadingAssets,
    isLoadingBase,
    isLoadingDecimals,
    isLoadingResolution,
    isLoadingRWAAssets,
    assetsError,
    baseError,
    decimalsError,
    resolutionError,
    rwaAssetsError,
    error,
  };
};
