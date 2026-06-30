import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import type { VaultLiveStats } from "../types/vault";

const VAULT_CONTRACT_ID =
  "CBHGX6TCHHVYJ7P3UZS7WI5TRAAA7GQA2L2Y7P2LCPIXWWD5FKDF2Z5S";

const ONE_SHARE = 1_000_000_000_000n;

function formatTvl(stroops: bigint): string {
  const value = Number(fromSmallestUnit(stroops.toString(), 7));
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}k`;
  return `$${value.toFixed(2)}`;
}

/** Safely extracts the value from a stellar SDK Result<T> or a raw value. */
function unwrapResult<T>(result: unknown, fallback: T): T {
  if (result === null || result === undefined) return fallback;
  const obj = result as Record<string, unknown>;
  if (typeof obj.unwrap === "function") {
    try {
      return (obj.unwrap as () => T)();
    } catch {
      return fallback;
    }
  }
  if (obj.tag === "ok") return obj.value as T;
  return result as T;
}

export function useVaultData() {
  const client = useMemo(
    () =>
      new DefindexVaultClient({
        contractId: VAULT_CONTRACT_ID,
        rpcUrl,
        networkPassphrase,
        ...(allowHttpForSoroban && { allowHttp: true }),
      }),
    []
  );

  return useQuery<VaultLiveStats & { tvlFormatted: string }>({
    queryKey: ["vaultData", VAULT_CONTRACT_ID],
    queryFn: async () => {
      const [totalManagedTx, totalSupplyTx] = await Promise.all([
        client.fetch_total_managed_funds({ simulate: true }),
        client.total_supply({ simulate: true }),
      ]);

      const allocations = unwrapResult<Array<{ total_amount: bigint }>>(
        totalManagedTx.result,
        []
      );
      const tvl =
        allocations.length > 0
          ? BigInt(allocations[0].total_amount.toString())
          : 0n;

      const totalShares = BigInt(totalSupplyTx.result?.toString() ?? "0");

      // price per share scaled by 1e12 to avoid integer division loss
      // pricePerShare = tvl * 1e12 / totalShares
      // userValue = userShares * pricePerShare / 1e12
      const pricePerShare =
        totalShares > 0n ? (tvl * ONE_SHARE) / totalShares : 0n;

      return {
        tvl,
        totalShares,
        pricePerShare,
        tvlFormatted: formatTvl(tvl),
      };
    },
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
    retry: false,
    throwOnError: false,
  });
}
