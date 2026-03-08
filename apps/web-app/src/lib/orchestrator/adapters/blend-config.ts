import type { Network } from "@blend-capital/blend-sdk";
import {
  rpcUrl,
  networkPassphrase,
  stellarNetwork,
} from "@/lib/constants/network";

export function getBlendNetwork(): Network {
  return { rpc: rpcUrl, passphrase: networkPassphrase };
}

export const BLEND_POOLS: Record<string, string[]> = {
  TESTNET: ["CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF"],
  PUBLIC: [],
};

export function getBlendPoolIds(): string[] {
  return BLEND_POOLS[stellarNetwork] ?? [];
}
