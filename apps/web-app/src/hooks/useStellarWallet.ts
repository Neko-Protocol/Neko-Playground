"use client";

import { ISupportedWallet } from "@creit.tech/stellar-wallets-kit";
import { WALLET_CONNECT_ID } from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";
import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";
import { notify } from "@/lib/toast";

const FREIGHTER_MOBILE_TOAST_KEY = "neko_freighter_mobile_toast_shown";

function isFreighterMobileBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const s = (
    window as Window & { stellar?: { provider?: string; platform?: string } }
  ).stellar;
  return s?.provider === "freighter" && s?.platform === "mobile";
}

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

        // When in Freighter's mobile in-app browser the only available option
        // is WalletConnect. Freighter will show an "Untrusted Transaction Domain"
        // warning the first time a transaction comes through — remind the user to
        // tap Trust so transactions don't get silently rejected.
        if (
          wallet.id === WALLET_CONNECT_ID &&
          isFreighterMobileBrowser() &&
          !sessionStorage.getItem(FREIGHTER_MOBILE_TOAST_KEY)
        ) {
          sessionStorage.setItem(FREIGHTER_MOBILE_TOAST_KEY, "1");
          notify("Trust this domain in Freighter", "info", {
            description:
              "When Freighter asks to trust this domain, tap Trust — otherwise transaction signing will be blocked.",
            duration: 8000,
          });
        }
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
