"use client";

import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";
import { useQueryClient } from "@tanstack/react-query";

export function useStellarWallet() {
  const { address, walletName, setWallet, clearWallet } =
    useStellarWalletStore();
  const queryClient = useQueryClient();

  const connect = async () => {
    const Kit = await getStellarWalletKit();

    // v2 authModal returns { address } directly — no callback needed.
    const { address: walletAddress } = await Kit.authModal();
    setWallet({ address: walletAddress, walletName: "Stellar Wallet" });
  };

  const disconnect = async () => {
    const Kit = await getStellarWalletKit();
    await Kit.disconnect();

    // Clear all address-scoped query cache entries to prevent data bleeding
    // ["backstopWalletBalance"], ["backstopDeposit"], ["balances"], ["orchestrator"], ["userLendingBTokens"], ["portfolio-value"], ["health-factor"], ["userCollateral"], ["borrowLimit"], ["userBorrowPosition"], ["userDebt"], ["repayWalletBalance"], ["tokenBalance"], ["stellar-balances"], ["vaultBalance"], ["cetesBalance"], ["soroban-faucet-balances"]
    const addressScopedPrefixes = [
      "backstopWalletBalance",
      "backstopDeposit",
      "balances",
      "orchestrator",
      "userLendingBTokens",
      "portfolio-value",
      "health-factor",
      "userCollateral",
      "borrowLimit",
      "userBorrowPosition",
      "userDebt",
      "repayWalletBalance",
      "tokenBalance",
      "stellar-balances",
      "vaultBalance",
      "cetesBalance",
      "soroban-faucet-balances",
    ];

    addressScopedPrefixes.forEach((prefix) => {
      queryClient.removeQueries({ queryKey: [prefix] });
    });

    clearWallet();
  };

  return {
    address: address ?? null,
    walletName: walletName ?? null,
    isConnected: Boolean(address),
    connect,
    disconnect,
  };
}
