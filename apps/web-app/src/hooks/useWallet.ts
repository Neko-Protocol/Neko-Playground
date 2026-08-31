"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchBalances,
  signStellarTransactionWithWallet,
  signStellarMessageWithWallet,
  type MappedBalances,
} from "@/lib/helpers/stellar/wallet";
import { stellarNetwork, networkPassphrase } from "@/lib/constants/network";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";

export function useWallet() {
  const { address: stellarAddress } = useStellarWalletStore();
  const address = stellarAddress ?? undefined;

  const {
    data: { balances = {} as MappedBalances, subentryCount = 0 } = {},
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

  // Signs an arbitrary message — used for the event platform's
  // wallet-ownership challenge (see lib/event-platform/auth/challenge.ts).
  const signMessage = async (message: string) => {
    if (!address) {
      throw new Error("Connect Stellar wallet to sign");
    }
    return signStellarMessageWithWallet({ message, signerAddress: address });
  };

  return {
    address: address ?? undefined,
    network: stellarNetwork,
    networkPassphrase,
    balances,
    subentryCount,
    isFetchingBalances,
    isPending: false,
    refetchBalances: async () => {
      await refetchBalances();
    },
    signTransaction,
    signMessage,
  };
}
