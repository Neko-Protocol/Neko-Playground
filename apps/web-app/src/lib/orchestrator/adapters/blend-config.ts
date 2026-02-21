/**
 * Configuration for Blend Protocol pool discovery and network setup.
 */

import type { Network } from "@blend-capital/blend-sdk";
import {
  rpcUrl,
  networkPassphrase,
  stellarNetwork,
} from "@/lib/constants/network";

export function getBlendNetwork(): Network {
  return { rpc: rpcUrl, passphrase: networkPassphrase };
}

/**
 * Known Blend pool contract addresses per network.
 * Add pool contract IDs as they become available.
 */
export const BLEND_POOLS: Record<string, string[]> = {
  TESTNET: ["CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF"],
  PUBLIC: [
    // Blend mainnet pool contract IDs
  ],
};

/** Returns the pool contract IDs for the current network. */
export function getBlendPoolIds(): string[] {
  return BLEND_POOLS[stellarNetwork] ?? [];
}
