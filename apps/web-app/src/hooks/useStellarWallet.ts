"use client";

/**
 * Hook para conectar y desconectar la wallet Stellar.
 * Abre el modal del Kit, guarda address y walletName en el store al conectar,
 * y limpia el Kit y el store al desconectar.
 */

import { ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
import { getStellarWalletKit } from "@/lib/helpers/stellar-wallet-kit";
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
