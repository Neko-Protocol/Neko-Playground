"use client";

import { Networks, StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";

let initialized = false;

export async function getStellarWalletKit(): Promise<typeof StellarWalletsKit> {
  if (typeof window === "undefined") {
    throw new Error("Stellar Wallet Kit can only be used in the browser.");
  }
  if (initialized) return StellarWalletsKit;

  const [{ FreighterModule }, { AlbedoModule }, { xBullModule }] =
    await Promise.all([
      import("@creit.tech/stellar-wallets-kit/modules/freighter"),
      import("@creit.tech/stellar-wallets-kit/modules/albedo"),
      import("@creit.tech/stellar-wallets-kit/modules/xbull"),
    ]);

  StellarWalletsKit.init({
    network: Networks.TESTNET,
    modules: [new FreighterModule(), new AlbedoModule(), new xBullModule()],
  });

  initialized = true;
  return StellarWalletsKit;
}
