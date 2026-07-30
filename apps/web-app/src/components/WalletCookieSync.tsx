"use client";

import { useEffect } from "react";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";
import {
  clearWalletAddressCookie,
  setWalletAddressCookie,
} from "@/lib/wallet-cookie";
import { setRampWalletPublicKey } from "@/features/on-off-ramps/utils/rampApi";

/**
 * Syncs persisted wallet address to a cookie after zustand rehydrates so
 * middleware can gate /dashboard/admin for sessions that predate the cookie.
 */
export function WalletCookieSync() {
  useEffect(() => {
    const sync = (address: string | null) => {
      if (address) {
        setWalletAddressCookie(address);
        setRampWalletPublicKey(address);
      } else {
        clearWalletAddressCookie();
        setRampWalletPublicKey(null);
      }
    };

    sync(useStellarWalletStore.getState().address);

    return useStellarWalletStore.persist.onFinishHydration(() => {
      sync(useStellarWalletStore.getState().address);
    });
  }, []);

  useEffect(() => {
    return useStellarWalletStore.subscribe((state) => {
      if (state.address) {
        setWalletAddressCookie(state.address);
        setRampWalletPublicKey(state.address);
      } else {
        clearWalletAddressCookie();
        setRampWalletPublicKey(null);
      }
    });
  }, []);

  return null;
}
