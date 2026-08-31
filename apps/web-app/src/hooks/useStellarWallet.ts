"use client";

import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { clearUserScopedQueries } from "@/lib/query/userScopedQueries";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";
import { useQueryClient } from "@tanstack/react-query";
import { clearAnchorState } from "@/features/on-off-ramps/constants/ramp.config";

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

    // Clear per-wallet anchor state (customer ID, bank account ID, onboarding
    // URL) so that the next wallet to connect gets a fresh identity slot and
    // cannot inherit the ramp state of the wallet that just disconnected.
    if (address) {
      clearAnchorState(address);
    }

    // Drop everything user-scoped from the query cache so nothing from this
    // wallet (balances, positions, KYC status, fiat accounts) can render from
    // cache for whoever connects next. Global market data survives; see
    // lib/query/userScopedQueries.ts for the invariant.
    clearUserScopedQueries(queryClient);

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
