"use client";

import { useEffect, useRef } from "react";
import { ModuleType } from "@creit.tech/stellar-wallets-kit";
import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";

/**
 * Silently auto-connects when the dApp is opened inside a wallet's in-app
 * browser (e.g. Lobstr, xBull mobile). The wallet module's `isPlatformWrapper`
 * flag tells the kit it is wrapping the page, so we can skip the modal.
 *
 * Bridge wallets (WalletConnect) are explicitly excluded: their `getAddress()`
 * triggers a QR-code / pairing flow when no session exists, which would pop up
 * uninvited. Only HOT_WALLET modules (Lobstr, xBull, Freighter in-app browsers)
 * can be safely auto-connected.
 *
 * Runs once on mount. No-ops if the user is already connected or no
 * platform-wrapper wallet is detected.
 */
export function WalletAutoConnect() {
  const { address, setWallet } = useStellarWalletStore();
  const attempted = useRef(false);

  useEffect(() => {
    if (address || attempted.current) return;
    attempted.current = true;

    void (async () => {
      try {
        const kit = getStellarWalletKit();
        const wallets = await kit.getSupportedWallets();
        const platformWallet = wallets.find(
          (w) =>
            w.isPlatformWrapper &&
            w.isAvailable &&
            w.type !== ModuleType.BRIDGE_WALLET
        );
        if (!platformWallet) return;
        kit.setWallet(platformWallet.id);
        const { address: walletAddress } = await kit.getAddress();
        if (walletAddress) {
          setWallet({
            address: walletAddress,
            walletName: platformWallet.name,
          });
        }
      } catch {
        // Silently fail — user can always connect manually via the button.
      }
    })();
  }, [address, setWallet]);

  return null;
}
