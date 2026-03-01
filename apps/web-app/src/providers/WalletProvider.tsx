import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

/** Options accepted by the Stellar wallet's signTransaction. */
interface StellarSignOptions {
  networkPassphrase?: string;
  address?: string;
  submit?: boolean;
  submitUrl?: string;
  [key: string]: unknown;
}
import { getWallet, type MappedBalances } from "@/lib/helpers/stellar/wallet";
import storage from "@/lib/helpers/storage";
import { useBalances } from "@/hooks";
import { POLL_INTERVAL, STORAGE_KEYS } from "@/lib/constants/wallet";

const getWalletInstance = () => {
  if (typeof window === "undefined") {
    throw new Error("Wallet can only be accessed in the browser");
  }
  return getWallet();
};

const signTransaction = (xdr: string, options: StellarSignOptions) => {
  const wallet = getWalletInstance();
  return wallet.signTransaction(xdr, options);
};

export interface WalletContextType {
  address?: string;
  balances: MappedBalances;
  isPending: boolean;
  isFetchingBalances: boolean;
  network?: string;
  networkPassphrase?: string;
  signTransaction: (
    xdr: string,
    options: StellarSignOptions
  ) => Promise<{ signedTxXdr: string }>;
  /**
   * Manually trigger a refetch of balances.
   * Uses React Query's refetch mechanism.
   */
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
  const [isPending, startTransition] = useTransition();
  const popupLock = useRef(false);

  // Use React Query hook for balances with intelligent polling
  const {
    data: balances = {},
    isFetching: isFetchingBalances,
    refetch: refetchBalances,
  } = useBalances(address, {
    enabled: Boolean(address),
    refetchInterval: 10000, // Poll every 10 seconds
    refetchOnWindowFocus: false,
    keepPreviousData: true, // Keep previous data while fetching to prevent flickering
    retry: 2,
  });

  const nullify = () => {
    setAddress(undefined);
    setNetwork(undefined);
    setNetworkPassphrase(undefined);
    storage.setItem(STORAGE_KEYS.walletId, "");
    storage.setItem(STORAGE_KEYS.walletAddress, "");
    storage.setItem(STORAGE_KEYS.walletNetwork, "");
    storage.setItem(STORAGE_KEYS.networkPassphrase, "");
  };

  const updateCurrentWalletState = async () => {
    // There is no way, with StellarWalletsKit, to check if the wallet is
    // installed/connected/authorized. We need to manage that on our side by
    // checking our storage item.
    const walletId = storage.getItem(STORAGE_KEYS.walletId);
    const walletNetwork = storage.getItem(STORAGE_KEYS.walletNetwork);
    const walletAddr = storage.getItem(STORAGE_KEYS.walletAddress);
    const passphrase = storage.getItem(STORAGE_KEYS.networkPassphrase);

    if (
      !address &&
      walletAddr !== null &&
      walletNetwork !== null &&
      passphrase !== null
    ) {
      setAddress(walletAddr);
      setNetwork(walletNetwork);
      setNetworkPassphrase(passphrase);
    }

    if (!walletId) {
      nullify();
    } else {
      if (popupLock.current) return;
      // If our storage item is there, then we try to get the user's address &
      // network from their wallet. Note: `getAddress` MAY open their wallet
      // extension, depending on which wallet they select!
      try {
        popupLock.current = true;
        const wallet = getWalletInstance();
        wallet.setWallet(walletId);
        if (walletId !== "freighter" && walletAddr !== null) return;
        const [a, n] = await Promise.all([
          wallet.getAddress(),
          wallet.getNetwork(),
        ]);

        if (!a.address) storage.setItem(STORAGE_KEYS.walletId, "");
        if (
          a.address !== address ||
          n.network !== network ||
          n.networkPassphrase !== networkPassphrase
        ) {
          storage.setItem(STORAGE_KEYS.walletAddress, a.address);
          setAddress(a.address);
          setNetwork(n.network);
          setNetworkPassphrase(n.networkPassphrase);
        }
      } catch (e) {
        // If `getNetwork` or `getAddress` throw errors... sign the user out???
        nullify();
        // then log the error (instead of throwing) so we have visibility
        // into the error while working on Scaffold Stellar but we do not
        // crash the app process
        console.error(e);
      } finally {
        popupLock.current = false;
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const pollWalletState = () => {
      if (!isMounted) return;
      void updateCurrentWalletState();
    };

    startTransition(async () => {
      await updateCurrentWalletState();
    });

    const intervalId = setInterval(pollWalletState, POLL_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- it SHOULD only run once per component mount

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

  return <WalletContext value={contextValue}>{children}</WalletContext>;
};
