import { useAccount } from "wagmi";
import { useWallet as useStellarWallet } from "./useWallet";

/**
 * Hook to detect which type of wallet is connected (EVM or Stellar).
 * Returns the wallet type and connection status.
 */
export type WalletType = "evm" | "stellar" | "none";

export const useWalletType = () => {
  const { isConnected: isEvmConnected, address: evmAddress } = useAccount();
  const { address: stellarAddress } = useStellarWallet();

  // Determine wallet type
  const walletType: WalletType =
    isEvmConnected && evmAddress ? "evm" : stellarAddress ? "stellar" : "none";

  return {
    walletType,
    isEvmConnected: isEvmConnected && !!evmAddress,
    isStellarConnected: !!stellarAddress,
    evmAddress: evmAddress || undefined,
    stellarAddress: stellarAddress || undefined,
  };
};
