"use client";

import { useQuery } from "@tanstack/react-query";
import type { MappedBalances } from "@/lib/helpers/stellar/wallet";
import { fetchBalances } from "@/lib/helpers/stellar/wallet";
import { signStellarTransactionWithWallet } from "@/lib/helpers/sign-stellar-transaction";
import { stellarNetwork, networkPassphrase } from "@/lib/constants/network";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";

export function useWallet() {
  const { address: stellarAddress } = useStellarWalletStore();
  const address = stellarAddress ?? undefined;

  const {
    data: balances = {} as MappedBalances,
    isFetching: isFetchingBalances,
    refetch: refetchBalances,
  } = useQuery({
    queryKey: ["stellar-balances", address],
    queryFn: () => fetchBalances(address!),
    enabled: Boolean(address),
  });

  const signTransaction = async (
    xdr: string,
    options?: { networkPassphrase?: string; address?: string }
  ) => {
    if (!address) {
      throw new Error("Connect Stellar wallet to sign");
    }
    const signerPublicKey = options?.address ?? address;
    const signedTxXdr = await signStellarTransactionWithWallet({
      unsignedTransactionXdr: xdr,
      signerPublicKey,
    });
    return { signedTxXdr };
  };

  return {
    address: address ?? undefined,
    network: stellarNetwork,
    networkPassphrase,
    balances,
    isFetchingBalances,
    isPending: false,
    refetchBalances: async () => {
      await refetchBalances();
    },
    signTransaction,
  };
}
