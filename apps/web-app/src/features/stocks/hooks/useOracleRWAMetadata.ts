import { useQuery } from "@tanstack/react-query";
import oracleClient from "@/lib/clients/oracle";
import type { RWAMetadata } from "@neko/oracle";
import { ORACLE_PRICE_STALE_MS } from "../constants/oracle";

export const useOracleRWAMetadata = (assetId: string) => {
  const {
    data: metadataResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["oracle", "rwa-metadata", assetId],
    queryFn: async () => {
      const result = await oracleClient.get_rwa_metadata({ asset_id: assetId });

      const resultData = result.result as {
        ok?: RWAMetadata;
        err?: { message?: string };
      };
      if ("err" in resultData && resultData.err) {
        throw new Error(resultData.err.message ?? "Oracle returned an error");
      }

      if (!resultData.ok) {
        throw new Error("Oracle returned no data");
      }

      return resultData.ok;
    },
    staleTime: ORACLE_PRICE_STALE_MS,
  });

  return {
    metadata: metadataResult,
    isLoading,
    error,
  };
};
