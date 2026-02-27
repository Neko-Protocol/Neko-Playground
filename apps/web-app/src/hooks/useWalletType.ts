import { useAccount } from "wagmi";
import { useWallet } from "./useWallet";

export type WalletType = "evm" | "stellar" | "none";

/**
 * Detects connected wallet type (EVM vs Stellar) and exposes addresses for UI.
 *
 * Resolution order is EVM-over-Stellar: if both are connected, the hook reports
 * "evm" as the active wallet type. UI should disconnect EVM first before
 * connecting or showing Stellar as primary. Do not change this priority without
 * updating flows that rely on it (e.g. WalletSelectorModal, ConnectWalletModal).
 */
export const useWalletType = () => {
  const { isConnected: isEvmConnected, address: evmAddress } = useAccount();
  const { address: stellarAddress } = useWallet();

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
