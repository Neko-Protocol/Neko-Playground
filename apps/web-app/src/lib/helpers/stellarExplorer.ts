import type { NetworkType } from "@/lib/constants/network";

const EXPLORER_NETWORK_SEGMENT: Record<string, string> = {
  mainnet: "public",
  testnet: "testnet",
  futurenet: "futurenet",
};

/**
 * Returns a Stellar Expert contract URL for the given network, or null for custom/local.
 */
export function getStellarExpertContractUrl(
  contractId: string,
  networkId: NetworkType
): string | null {
  const seg = EXPLORER_NETWORK_SEGMENT[networkId];
  if (!seg) return null;
  return `https://stellar.expert/explorer/${seg}/contract/${contractId}`;
}
