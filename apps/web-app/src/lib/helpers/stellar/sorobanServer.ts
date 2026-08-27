import { rpc } from "@stellar/stellar-sdk";
import { rpcUrl, stellarNetwork } from "@/lib/config/stellar.config";

const serverCache = new Map<string, rpc.Server>();

function resolveAllowHttp(): boolean {
  return stellarNetwork === "LOCAL";
}

/**
 * Returns a memoized Soroban RPC client for the given URL (defaults to app config).
 * Only this module constructs `new rpc.Server`.
 */
export function getSorobanServer(url: string = rpcUrl): rpc.Server {
  const cached = serverCache.get(url);
  if (cached) return cached;

  const server = new rpc.Server(url, { allowHttp: resolveAllowHttp() });
  serverCache.set(url, server);
  return server;
}

/** Clears the memoized server cache (for tests). */
export function resetSorobanServerCache(): void {
  serverCache.clear();
}
