import { useAccount } from "wagmi";
import { useWallet } from "./useWallet";

export type WalletType = "evm" | "stellar" | "none";

/** Detects connected wallet type (EVM vs Stellar) and exposes addresses for UI. */
export const useWalletType = () => {
  const { isConnected: isEvmConnected, address: evmAddress } = useAccount();
  const { address: stellarAddress } = useWallet();

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
