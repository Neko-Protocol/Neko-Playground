"use client";

import type { StellarWalletsKit as StellarWalletsKitClass } from "@creit.tech/stellar-wallets-kit";
import { Networks } from "@creit.tech/stellar-wallets-kit/types";
import { getCurrentNetworkPassphrase } from "../network";
import { clientEnv } from "@/lib/env.client";

type Kit = typeof StellarWalletsKitClass;

let kit: Kit | null = null;
let initPromise: Promise<Kit> | null = null;

/**
 * Lazily loads and initialises the Stellar Wallets Kit.
 *
 * The @creit.tech/stellar-wallets-kit v2 root module initialises
 * @preact/signals at module scope and reads `globalThis.localStorage`,
 * which crashes during Next.js SSR/static prerendering.  By dynamically
 * importing the package only inside this function we guarantee the code
 * only ever runs in the browser.
 */
export async function getStellarWalletKit(): Promise<Kit> {
  if (typeof window === "undefined") {
    throw new Error("Stellar Wallet Kit can only be used in the browser.");
  }

  if (kit) return kit;

  if (!initPromise) {
    initPromise = (async () => {
      const [
        { StellarWalletsKit },
        { FreighterModule },
        { AlbedoModule },
        { xBullModule },
        { LedgerModule },
        { LobstrModule },
        { WalletConnectModule },
      ] = await Promise.all([
        import("@creit.tech/stellar-wallets-kit"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/modules/albedo"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/modules/ledger"),
        import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
        import("@creit.tech/stellar-wallets-kit/modules/wallet-connect"),
      ]);

      const network = getCurrentNetworkPassphrase() as Networks;

      StellarWalletsKit.init({
        network,
        modules: [
          new FreighterModule(),
          new AlbedoModule(),
          new xBullModule(),
          new LedgerModule(),
          new LobstrModule(),
          new WalletConnectModule({
            projectId: clientEnv.walletConnectProjectId,
            metadata: {
              name: "Neko",
              description: "Neko — All-in-one platform for RWAs on Stellar",
              url: "https://nekoprotocol.xyz",
              icons: ["/Neko.svg"],
            },
          }),
        ],
        theme: {
          background: "#1C1C1C",
          "background-secondary": "#121212",
          "foreground-strong": "#FFFFFF",
          foreground: "rgba(255,255,255,0.85)",
          "foreground-secondary": "rgba(255,255,255,0.6)",
          primary: "#229EDF",
          "primary-foreground": "#FFFFFF",
          transparent: "rgba(0, 0, 0, 0)",
          lighter: "rgba(255,255,255,0.08)",
          light: "rgba(255,255,255,0.06)",
          "light-gray": "rgba(255,255,255,0.35)",
          gray: "rgba(255,255,255,0.25)",
          danger: "oklch(57.7% 0.245 27.325)",
          border: "rgba(255,255,255,0.08)",
          shadow:
            "0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -4px rgba(0,0,0,0.2)",
          "border-radius": "0.75rem",
          "font-family": "inherit",
        },
      });

      kit = StellarWalletsKit;
      return StellarWalletsKit;
    })();
  }

  return initPromise;
}

export const getWallet = () => getStellarWalletKit();
