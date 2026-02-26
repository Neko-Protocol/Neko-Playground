"use client";

import { getWallet } from "@/lib/helpers/wallet";
import { useWalletStore } from "@/stores/walletStore";

export function useWalletConnection() {
  const { address, setWallet, clearWallet } = useWalletStore();

  const connect = async () => {
    const kit = getWallet();
    await kit.openModal({
      modalTitle: "Connect to your wallet",
      onWalletSelected: async (wallet: { id: string; name: string }) => {
        kit.setWallet(wallet.id);
        const { address: walletAddress } = await kit.getAddress();
        setWallet({ address: walletAddress, walletName: wallet.name });
      },
    });
  };

  const disconnect = async () => {
    const kit = getWallet();
    await kit.disconnect();
    clearWallet();
  };

  return {
    connect,
    disconnect,
    isConnected: Boolean(address),
    address: address ?? null,
  };
}
