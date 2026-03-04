import { useWallet } from "./useWallet";

export type WalletType = "stellar" | "none";

export const useWalletType = () => {
  const { address: stellarAddress } = useWallet();

  const walletType: WalletType = stellarAddress ? "stellar" : "none";

  return {
    walletType,
    isStellarConnected: !!stellarAddress,
    stellarAddress: stellarAddress || undefined,
  };
};
