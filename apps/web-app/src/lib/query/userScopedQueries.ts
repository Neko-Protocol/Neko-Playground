import type { QueryClient, QueryKey } from "@tanstack/react-query";

/**
 * Query-key prefixes whose data is GLOBAL, i.e. provably identical for any
 * two visitors: market prices, pool catalogs, oracle metadata. These are the
 * only cache entries that survive a wallet disconnect.
 *
 * The invariant is deliberately inverted from the old hand-maintained
 * `addressScopedPrefixes` list that used to live in
 * `useStellarWallet.disconnect()`: every query is treated as user-scoped
 * unless a prefix here says otherwise. A new hook nobody remembers to
 * register costs one extra refetch after disconnect; it can never leak the
 * previous wallet's data (KYC status, fiat accounts, balances, positions) to
 * the next user. That asymmetry is the point, and it is why queries keyed by
 * `customerId` or a contract id rather than the address are covered without
 * anyone having to know they exist.
 *
 * Add a prefix here ONLY if the data would be identical for any two
 * visitors. When unsure, leave it out: the worst case is a refetch.
 *
 * Prefixes match positionally from the start of the key:
 * ["orchestrator", "pool"] keeps ["orchestrator", "pool", poolId] but not
 * ["orchestrator", "position", poolId, address].
 */
export const GLOBAL_QUERY_KEY_PREFIXES: readonly (readonly string[])[] = [
  ["lendingPools"],
  ["borrowPools"],
  ["oracle"],
  ["orchestrator", "pool"],
  ["orchestrator", "pools"],
  ["admin"],
  ["portfolioPrice"],
  ["tokenPrice"],
  ["leverage-builder-price"],
  ["leverage-builder-route"],
  ["vault-apy"],
  ["vaultData"],
  ["vault-invest-status"],
  ["backstopToken"],
  ["portfolioBackstopToken"],
  ["bad-debt-auctions"],
];

export function isGlobalQueryKey(queryKey: QueryKey): boolean {
  return GLOBAL_QUERY_KEY_PREFIXES.some((prefix) =>
    prefix.every((segment, i) => queryKey[i] === segment)
  );
}

/**
 * Remove every cached query that is not provably global. Called on wallet
 * disconnect so nothing scoped to the previous session (by address,
 * customerId, publicKey or position) can be served from cache to whoever
 * connects next on the same machine.
 */
export function clearUserScopedQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({
    predicate: (query) => !isGlobalQueryKey(query.queryKey),
  });
}
