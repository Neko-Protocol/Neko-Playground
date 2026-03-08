"use client";

import { useMemo } from "react";
import { useSorobanTokenBalances } from "@/hooks/useSorobanTokenBalances";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { stellarNetwork } from "@/lib/constants/network";

function isMissing(balance: string): boolean {
  const n = parseFloat(balance);
  return Number.isNaN(n) || n <= 0;
}

export function useMissingRwaTokens() {
  const { address, isConnected } = useStellarWallet();
  const { balances, isFetching } = useSorobanTokenBalances();

  const hasMissing = useMemo(
    () => balances.some((t) => isMissing(t.balance)),
    [balances]
  );

  const shouldShowBanner = Boolean(
    isConnected && address && stellarNetwork !== "PUBLIC" && hasMissing
  );

  return {
    balances,
    isFetching,
    isConnected,
    shouldShowBanner,
  };
}
