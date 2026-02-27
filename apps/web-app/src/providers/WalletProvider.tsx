import {
  createContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { getWallet, type MappedBalances } from "@/lib/helpers/stellar/wallet";
import storage from "@/lib/helpers/storage";
import { useBalances } from "@/hooks";

const getWalletInstance = () => {
  if (typeof window === "undefined") {
    throw new Error("Wallet can only be accessed in the browser");
  }
  return getWallet();
};

const signTransaction = (xdr: string, options: any) => {
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
  signTransaction: (xdr: string, options: any) => Promise<any>;
  /**
   * Manually trigger a refetch of balances.
   * Uses React Query's refetch mechanism.
   */
  refetchBalances: () => Promise<void>;
}

const POLL_INTERVAL = 1000;

export const WalletContext = // eslint-disable-line react-refresh/only-export-components
  createContext<WalletContextType>({
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
    storage.setItem("walletId", "");
    storage.setItem("walletAddress", "");
    storage.setItem("walletNetwork", "");
    storage.setItem("networkPassphrase", "");
  };

  const updateCurrentWalletState = async () => {
    // There is no way, with StellarWalletsKit, to check if the wallet is
    // installed/connected/authorized. We need to manage that on our side by
    // checking our storage item.
    const walletId = storage.getItem("walletId");
    const walletNetwork = storage.getItem("walletNetwork");
    const walletAddr = storage.getItem("walletAddress");
    const passphrase = storage.getItem("networkPassphrase");

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

        if (!a.address) storage.setItem("walletId", "");
        if (
          a.address !== address ||
          n.network !== network ||
          n.networkPassphrase !== networkPassphrase
        ) {
          storage.setItem("walletAddress", a.address);
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
    let timer: NodeJS.Timeout;
    let isMounted = true;

    // Create recursive polling function to check wallet state continuously
    const pollWalletState = async () => {
      if (!isMounted) return;

      await updateCurrentWalletState();

      if (isMounted) {
        timer = setTimeout(() => void pollWalletState(), POLL_INTERVAL);
      }
    };

    // Get the wallet address when the component is mounted for the first time
    startTransition(async () => {
      await updateCurrentWalletState();
      // Start polling after initial state is loaded

      if (isMounted) {
        timer = setTimeout(() => void pollWalletState(), POLL_INTERVAL);
      }
    });

    // Clear the timeout and stop polling when the component unmounts
    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- it SHOULD only run once per component mount

  // Wrapper function for refetch that matches the expected signature
  const handleRefetchBalances = async () => {
    await refetchBalances();
  };

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
      refetchBalances,
    ]
  );

  return <WalletContext value={contextValue}>{children}</WalletContext>;
};
