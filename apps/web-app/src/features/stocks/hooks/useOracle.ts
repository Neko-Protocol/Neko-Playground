import { useQuery } from "@tanstack/react-query";
import oracleClient from "@/lib/clients/oracle";
export const useOracle = () => {
  // Fetch all assets
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
  });

  // Fetch base asset
  const { data: baseAsset, isLoading: isLoadingBase } = useQuery({
    queryKey: ["oracle", "base"],
    queryFn: async () => {
      const result = await oracleClient.base();
      return result.result;
    },
  });

  // Fetch decimals
  const { data: decimals, isLoading: isLoadingDecimals } = useQuery({
    queryKey: ["oracle", "decimals"],
    queryFn: async () => {
      const result = await oracleClient.decimals();
      return result.result;
    },
  });

  // Fetch resolution
  const { data: resolution, isLoading: isLoadingResolution } = useQuery({
    queryKey: ["oracle", "resolution"],
    queryFn: async () => {
      const result = await oracleClient.resolution();
      return result.result;
    },
  });

  // Fetch all RWA assets
  const { data: rwaAssets, isLoading: isLoadingRWAAssets } = useQuery({
    queryKey: ["oracle", "rwa-assets"],
    queryFn: async () => {
      const result = await oracleClient.get_all_rwa_assets();
      return result.result;
    },
    enabled: !!assets,
  });

  const isLoading =
    isLoadingAssets ||
    isLoadingBase ||
    isLoadingDecimals ||
    isLoadingResolution ||
    isLoadingRWAAssets;

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
  };
};
