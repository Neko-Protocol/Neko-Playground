import { useWallet } from "./useWallet";

export type WalletType = "stellar" | "none";

export const useWalletType = () => {
  const { address: stellarAddress } = useWallet();

  const walletType: WalletType = stellarAddress ? "stellar" : "none";

  return {
    walletType,
    isEvmConnected: false,
    isStellarConnected: !!stellarAddress,
    evmAddress: undefined,
    stellarAddress: stellarAddress || undefined,
  };
};
