import { useQuery } from "@tanstack/react-query";
import oracleClient from "@/lib/clients/oracle";
import type { RWAMetadata } from "@neko/oracle";

export const useOracleRWAMetadata = (assetId: string) => {
  const {
    data: metadataResult,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["oracle", "rwa-metadata", assetId],
    queryFn: async () => {
      const result = await oracleClient.get_rwa_metadata({ asset_id: assetId });

      // The generated client returns AssembledTransaction with result: { ok: ..., err: ... }
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
  });

  const metadata = metadataResult;

  return {
    metadata,
    isLoading,
    error,
  };
};
