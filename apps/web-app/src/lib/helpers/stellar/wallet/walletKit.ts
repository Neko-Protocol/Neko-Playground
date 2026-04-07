"use client";

import {
  StellarWalletsKit,
  FREIGHTER_ID,
  FreighterModule,
  AlbedoModule,
  xBullModule,
  LobstrModule,
} from "@creit.tech/stellar-wallets-kit";
import { LedgerModule } from "@creit.tech/stellar-wallets-kit/modules/ledger.module";
import {
  WalletConnectAllowedMethods,
  WalletConnectModule,
} from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";
import { getCurrentNetworkPassphrase } from "../network";

let stellarWalletKitInstance: StellarWalletsKit | null = null;

export function getStellarWalletKit(): StellarWalletsKit {
  if (typeof window === "undefined") {
    throw new Error("Stellar Wallet Kit solo puede usarse en el navegador.");
  }
  if (!stellarWalletKitInstance) {
    const network = getCurrentNetworkPassphrase();
    stellarWalletKitInstance = new StellarWalletsKit({
      network,
      selectedWalletId: FREIGHTER_ID,
      modalTheme: {
        bgColor: "#1C1C1C",
        textColor: "rgba(255,255,255,0.85)",
        solidTextColor: "#FFFFFF",
        headerButtonColor: "#229EDF",
        dividerColor: "rgba(255,255,255,0.08)",
        helpBgColor: "rgba(255,255,255,0.04)",
        notAvailableTextColor: "rgba(255,255,255,0.35)",
        notAvailableBgColor: "rgba(255,255,255,0.04)",
        notAvailableBorderColor: "rgba(255,255,255,0.08)",
      },
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        new xBullModule(),
        new LedgerModule(),
        new LobstrModule(),
        new WalletConnectModule({
          url: "https://nekoprotocol.xyz",
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
          method: WalletConnectAllowedMethods.SIGN,
          name: "Neko Protocol",
          description: "Neko - All in one platform for RWA tokens",
          icons: ["/Neko.svg"],
          network,
        }),
      ],
    });
  }
  return stellarWalletKitInstance;
}

export function resetStellarWalletKit(): void {
  stellarWalletKitInstance = null;
}

export const getWallet = () => getStellarWalletKit();
