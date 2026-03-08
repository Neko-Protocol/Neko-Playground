"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "./useWallet";
import {
  fetchSorobanTokenBalances,
  type SorobanTokenBalance,
} from "@/lib/helpers/stellar/sorobanBalances";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
} from "@/lib/config/stellar.config";
import { useCallback } from "react";

const QUERY_KEY = "soroban-faucet-balances";

export function useSorobanTokenBalances() {
  const { address } = useWallet();
  const queryClient = useQueryClient();

  const { data, isFetching, refetch } = useQuery<SorobanTokenBalance[]>({
    queryKey: [QUERY_KEY, address],
    queryFn: () =>
      fetchSorobanTokenBalances(
        address!,
        rpcUrl,
        horizonUrl,
        networkPassphrase
      ),
    enabled: Boolean(address),
    refetchInterval: 15000,
    staleTime: 5000,
    retry: 2,
    throwOnError: false,
    placeholderData: (prev) => prev,
  });

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEY, address] });
  }, [queryClient, address]);

  return {
    balances: data ?? [],
    isFetching,
    refetch,
    invalidate,
  };
}
