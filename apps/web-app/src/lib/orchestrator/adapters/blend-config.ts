import type { Network } from "@blend-capital/blend-sdk";
import {
  rpcUrl,
  networkPassphrase,
} from "@/lib/constants/network";
import { getContracts } from "@/lib/constants/contractsByNetwork";

export function getBlendNetwork(): Network {
  return { rpc: rpcUrl, passphrase: networkPassphrase };
}

export function getBlendPoolIds(): string[] {
  return getContracts().blendPools;
}
