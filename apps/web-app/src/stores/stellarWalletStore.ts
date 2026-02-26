/**
 * Store del estado de la wallet Stellar conectada.
 * Persiste en localStorage para mantener la sesión al recargar.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StellarWalletState {
  /** Dirección (clave pública) de la wallet conectada, o null. */
  address: string | null;
  /** Nombre de la wallet (ej. "Freighter", "Albedo") para la UI. */
  walletName: string | null;
  /** Guarda la wallet tras una conexión exitosa. */
  setWallet: (payload: { address: string; walletName: string }) => void;
  /** Limpia el estado al desconectar. */
  clearWallet: () => void;
}

export const useStellarWalletStore = create<StellarWalletState>()(
  persist(
    (set) => ({
      address: null,
      walletName: null,
      setWallet: ({ address, walletName }) => set({ address, walletName }),
      clearWallet: () => set({ address: null, walletName: null }),
    }),
    { name: "stellar-wallet" }
  )
);
