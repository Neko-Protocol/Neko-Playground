"use client";

import { useQuery } from "@tanstack/react-query";
import { getContracts } from "@/lib/constants/contractsByNetwork";
import { useWallet } from "./useWallet";
import { getTokens, getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { getTokenAddress } from "@/lib/helpers/stellar/soroswap";
import { getTokenBalanceFromContract } from "@/lib/helpers/stellar/sorobanBalance";

const { nativeWrapper: NATIVE_WRAPPER_ADDRESS } = getContracts();

const BASE_RESERVE = 0.5;

const getXlmBalance = (
  balances: Record<string, { balance?: string } | undefined>,
  subentryCount: number
): string => {
  const xlmBalance = balances.xlm?.balance;
  if (xlmBalance) {
    const balance = parseFloat(xlmBalance.replace(/,/g, "") || "0");
    const minReserve = (2 + subentryCount) * BASE_RESERVE;
    const spendable = Math.max(0, balance - minReserve);
    return spendable.toString();
  }
  return "0";
};

const getTokenDecimals = (tokenAddress: string): number => {
  const tokens = getTokens();
  const availableTokens = getAvailableTokens();

  if (tokenAddress === tokens.XLM || tokenAddress === NATIVE_WRAPPER_ADDRESS) {
    return 7;
  }

  for (const [, info] of Object.entries(availableTokens)) {
    if (info.contract === tokenAddress) {
      return info.decimals || 7;
    }
  }

  return 7;
};

export const useTokenBalance = (
  token:
    | string
    | { type: "native" | "contract"; code?: string; contract?: string }
    | undefined
) => {
  const { address, balances, subentryCount } = useWallet();

  const tokenAddress = token ? getTokenAddress(token) : null;

  const tokens = getTokens();

  const isXlm =
    tokenAddress === tokens.XLM ||
    (typeof token !== "string" && token?.type === "native") ||
    tokenAddress === NATIVE_WRAPPER_ADDRESS;

  const {
    data: contractBalance = "0",
    isLoading,
    error,
  } = useQuery<string, Error>({
    queryKey: ["tokenBalance", tokenAddress, address],
    queryFn: async () => {
      if (!tokenAddress || !address) {
        return "0";
      }

      const decimals = getTokenDecimals(tokenAddress);
      return await getTokenBalanceFromContract(tokenAddress, address, decimals);
    },
    enabled: Boolean(tokenAddress && address && !isXlm),
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 5000, // Consider stale after 5 seconds
    retry: 2,
    throwOnError: false,
  });

  if (isXlm) {
    const balance = getXlmBalance(balances, subentryCount);
    return {
      balance,
      isLoading: false,
      error: null,
    };
  }

  return {
    balance: contractBalance,
    isLoading,
    error: error ? error.message : null,
  };
};
