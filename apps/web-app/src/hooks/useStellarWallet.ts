"use client";

import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet";
import { useStellarWalletStore } from "@/stores/stellarWalletStore";
import { useQueryClient } from "@tanstack/react-query";

/**
 * React Query key prefixes that scope to the connected wallet's address.
 * These are removed from the cache on wallet disconnect so that connecting a
 * second wallet in the same session never flashes the previous wallet's data.
 *
 * Protocol-level keys (pool configs, oracle prices, vault APYs, etc.) are
 * intentionally omitted — they contain no user data and can stay cached.
 */
const USER_SCOPED_QUERY_PREFIXES: readonly string[] = [
  "backstopDeposit",
  "backstopWalletBalance",
  "balances",
  "borrowLimit",
  "cetesBalance",
  "etherfuse-assets",
  "health-factor",
  "kyc-status",
  "portfolio-value",
  "repayWalletBalance",
  "stellar-balances",
  "tokenBalance",
  "userCollateral",
  "userDebt",
  "vaultBalance",
];

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

    // Capture the disconnecting address before clearing the store so we can
    // also remove address-tagged keys that don't use one of the known prefixes
    // (e.g. ["orchestrator", "position", poolId, address]).
    const previousAddress = address;

    queryClient.removeQueries({
      predicate: (query) => {
        const first = query.queryKey[0];
        if (
          typeof first === "string" &&
          USER_SCOPED_QUERY_PREFIXES.includes(first)
        ) {
          return true;
        }
        if (previousAddress) {
          return query.queryKey.some((k) => k === previousAddress);
        }
        return false;
      },
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
