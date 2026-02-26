"use client";

import { useQuery } from "@tanstack/react-query";
import type { MappedBalances } from "@/lib/helpers/wallet";
import { fetchBalances, getWallet } from "@/lib/helpers/wallet";
import { stellarNetwork, networkPassphrase } from "@/lib/constants/network";
import { useWalletStore } from "@/stores/walletStore";

export const useWallet = () => {
  const { address } = useWalletStore();

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
    const kit = getWallet();
    const result = await kit.signTransaction(xdr, {
      address: options?.address ?? address,
      networkPassphrase: options?.networkPassphrase ?? networkPassphrase,
    });
    return result;
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
};
