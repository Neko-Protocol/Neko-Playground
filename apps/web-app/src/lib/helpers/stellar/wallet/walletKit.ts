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
      modules: [
        new FreighterModule(),
        new AlbedoModule(),
        new xBullModule(),
        new LedgerModule(),
        new LobstrModule(),
        new WalletConnectModule({
          url: "https://nekoprotocol.xyz",
          projectId:
            process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
            "fa57d523d12455e4fc2c8c83c94ec7b1",
          method: WalletConnectAllowedMethods.SIGN,
          name: "Neko Protocol",
          description: "Neko — The Marketplace for Real-World Assets On-Chain",
          icons: ["/Neko.svg"],
          network,
        }),
      ],
    });
  }
  return stellarWalletKitInstance;
}

export const getWallet = () => getStellarWalletKit();
