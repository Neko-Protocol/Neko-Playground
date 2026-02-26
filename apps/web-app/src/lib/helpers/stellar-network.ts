import { WalletNetwork } from "@creit.tech/stellar-wallets-kit";
import { networkPassphrase } from "@/lib/constants/network";

export type StellarNetworkName = "testnet" | "mainnet";

export function getStellarNetworkPassphrase(
  networkName: StellarNetworkName
): WalletNetwork {
  if (networkName === "mainnet") return WalletNetwork.PUBLIC;
  return WalletNetwork.TESTNET;
}

export function getCurrentNetworkPassphrase(): WalletNetwork {
  return networkPassphrase as WalletNetwork;
}
