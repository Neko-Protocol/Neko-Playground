import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WalletState {
  address: string | null;
  walletName: string | null;
  setWallet: (payload: { address: string; walletName: string }) => void;
  clearWallet: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      address: null,
      walletName: null,
      setWallet: ({ address, walletName }) => set({ address, walletName }),
      clearWallet: () => set({ address: null, walletName: null }),
    }),
    { name: "neko-dapp-stellar-wallet" }
  )
);
