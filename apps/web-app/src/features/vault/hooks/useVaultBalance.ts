import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client as DefindexVaultClient } from "@neko/defindex-vault";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { getContracts } from "@/lib/constants/contractsByNetwork";
import { useWallet } from "@/hooks/useWallet";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";

const { vault: VAULT_CONTRACT_ID } = getContracts();

export function useVaultBalance() {
  const { address } = useWallet();

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

  const {
    data: userShares,
    isLoading,
    refetch,
  } = useQuery<bigint>({
    queryKey: ["vaultBalance", VAULT_CONTRACT_ID, address],
    queryFn: async () => {
      if (!address) return 0n;
      const tx = await client.balance({ id: address }, { simulate: true });
      return BigInt(tx.result?.toString() ?? "0");
    },
    enabled: !!address,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    throwOnError: false,
  });

  const sharesFormatted = userShares
    ? fromSmallestUnit(userShares.toString(), 7)
    : "0";

  return {
    userShares: userShares ?? 0n,
    sharesFormatted,
    isLoading,
    hasWallet: !!address,
    refetch,
  };
}
