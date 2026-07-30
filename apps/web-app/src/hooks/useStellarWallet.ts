"use client";

import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";
import { useQueryClient } from "@tanstack/react-query";
import {
  clearWalletAddressCookie,
  setWalletAddressCookie,
} from "@/lib/wallet-cookie";
import {
  authenticateWallet,
  logoutWalletSession,
} from "@/lib/auth/walletAuth";
import { setRampWalletPublicKey } from "@/features/on-off-ramps/utils/rampApi";

export function useStellarWallet() {
  const { address, walletName, setWallet, clearWallet } =
    useStellarWalletStore();
  const queryClient = useQueryClient();

  const connect = async () => {
    const Kit = await getStellarWalletKit();

    const { address: walletAddress } = await Kit.authModal();
    setWallet({ address: walletAddress, walletName: "Stellar Wallet" });
    setWalletAddressCookie(walletAddress);
    setRampWalletPublicKey(walletAddress);

    try {
      await authenticateWallet(walletAddress);
    } catch (error) {
      console.error("Wallet session authentication failed:", error);
    }
  };

  const disconnect = async () => {
    const Kit = await getStellarWalletKit();
    await Kit.disconnect();

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

    try {
      await logoutWalletSession();
    } catch {
      // ignore logout failures
    }

    setRampWalletPublicKey(null);
    clearWallet();
    clearWalletAddressCookie();
  };

  const reauthenticate = async () => {
    if (!address) return;
    setRampWalletPublicKey(address);
    await authenticateWallet(address);
  };

  return {
    address: address ?? null,
    walletName: walletName ?? null,
    isConnected: Boolean(address),
    connect,
    disconnect,
    reauthenticate,
  };
}
