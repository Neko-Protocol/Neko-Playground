"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useBalances } from "@/hooks/useBalances";
import { getStellarWalletKit } from "@/lib/helpers/stellar/walletKit";
import storage, { STORAGE_KEYS } from "@/lib/helpers/storage";

interface StellarSignOptions {
  networkPassphrase?: string;
  address?: string;
  [key: string]: unknown;
}

const signTransaction = async (
  xdr: string,
  options: StellarSignOptions
): Promise<{ signedTxXdr: string }> => {
  const Kit = await getStellarWalletKit();
  return Kit.signTransaction(xdr, options);
};

export interface WalletContextType {
  address?: string;
  balances: Record<string, string>;
  isPending: boolean;
  isFetchingBalances: boolean;
  network?: string;
  networkPassphrase?: string;
  signTransaction: (
    xdr: string,
    options: StellarSignOptions
  ) => Promise<{ signedTxXdr: string }>;
  refetchBalances: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType>({
  isPending: true,
  isFetchingBalances: false,
  balances: {},
  refetchBalances: async () => {},
  signTransaction,
});

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [address, setAddress] = useState<string>();
  const [network, setNetwork] = useState<string>();
  const [networkPassphrase, setNetworkPassphrase] = useState<string>();
  const [isPending, setIsPending] = useState(true);

  const {
    data: balances = {},
    isFetching: isFetchingBalances,
    refetch: refetchBalances,
  } = useBalances(address, {
    enabled: Boolean(address),
  });

  useEffect(() => {
    let cancelled = false;
    const unsubscribers: Array<() => void> = [];

    const init = async () => {
      const walletId = storage.getItem(STORAGE_KEYS.walletId);
      const walletAddr = storage.getItem(STORAGE_KEYS.walletAddress);
      const walletNetwork = storage.getItem(STORAGE_KEYS.walletNetwork);
      const passphrase = storage.getItem(STORAGE_KEYS.networkPassphrase);

      if (walletAddr && passphrase) {
        setAddress(walletAddr);
        setNetwork(walletNetwork || undefined);
        setNetworkPassphrase(passphrase);
      }

      if (walletId) {
        try {
          const Kit = await getStellarWalletKit();
          if (cancelled) return;
          Kit.setWallet(walletId);

          const { KitEventType } =
            await import("@creit.tech/stellar-wallets-kit");

          const offState = Kit.on(KitEventType.STATE_UPDATED, ({ payload }) => {
            if (payload.address) {
              storage.setItem(STORAGE_KEYS.walletAddress, payload.address);
              setAddress(payload.address);
            }
            if (payload.networkPassphrase) {
              storage.setItem(
                STORAGE_KEYS.networkPassphrase,
                payload.networkPassphrase
              );
              setNetworkPassphrase(payload.networkPassphrase);
            }
          });
          unsubscribers.push(offState);

          const offWallet = Kit.on(
            KitEventType.WALLET_SELECTED,
            ({ payload }) => {
              if (payload.id) {
                storage.setItem(STORAGE_KEYS.walletId, payload.id);
              }
            }
          );
          unsubscribers.push(offWallet);

          const offDisconnect = Kit.on(KitEventType.DISCONNECT, () => {
            storage.setItem(STORAGE_KEYS.walletId, "");
            storage.setItem(STORAGE_KEYS.walletAddress, "");
            storage.setItem(STORAGE_KEYS.walletNetwork, "");
            storage.setItem(STORAGE_KEYS.networkPassphrase, "");
            setAddress(undefined);
            setNetwork(undefined);
            setNetworkPassphrase(undefined);
          });
          unsubscribers.push(offDisconnect);
        } catch (e) {
          console.error("[WalletProvider] init failed", e);
        }
      }

      if (!cancelled) setIsPending(false);
    };

    void init();

    return () => {
      cancelled = true;
      for (const off of unsubscribers) {
        try {
          off();
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  const handleRefetchBalances = useCallback(async () => {
    await refetchBalances();
  }, [refetchBalances]);

  const contextValue = useMemo(
    () => ({
      address,
      network,
      networkPassphrase,
      balances,
      isFetchingBalances,
      refetchBalances: handleRefetchBalances,
      isPending,
      signTransaction,
    }),
    [
      address,
      network,
      networkPassphrase,
      balances,
      isFetchingBalances,
      isPending,
      handleRefetchBalances,
    ]
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};
