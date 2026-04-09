"use client";

import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";

export function useStellarWallet() {
  const { address, walletName, setWallet, clearWallet } =
    useStellarWalletStore();

  const connect = async () => {
    const Kit = await getStellarWalletKit();

    // v2 authModal returns { address } directly — no callback needed.
    const { address: walletAddress } = await Kit.authModal();
    setWallet({ address: walletAddress, walletName: "Stellar Wallet" });
  };

  const disconnect = async () => {
    const Kit = await getStellarWalletKit();
    await Kit.disconnect();
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
