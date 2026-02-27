"use client";

import { ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";

export function useStellarWallet() {
  const { address, walletName, setWallet, clearWallet } =
    useStellarWalletStore();

  const connect = async () => {
    const kit = getStellarWalletKit();
    await kit.openModal({
      modalTitle: "Connect to your favorite wallet",
      onWalletSelected: async (wallet: ISupportedWallet) => {
        kit.setWallet(wallet.id);
        const { address: walletAddress } = await kit.getAddress();
        setWallet({ address: walletAddress, walletName: wallet.name });
      },
    });
  };

  const disconnect = async () => {
    const kit = getStellarWalletKit();
    await kit.disconnect();
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
