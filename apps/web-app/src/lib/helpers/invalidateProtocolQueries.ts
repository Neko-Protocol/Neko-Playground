import type { QueryClient } from "@tanstack/react-query";

export type InvalidationScope = "pools" | "positions" | "rates" | "all";

const SCOPE_KEYS: Record<Exclude<InvalidationScope, "all">, readonly (readonly string[])[]> = {
  pools: [
    ["borrowPools"],
    ["lendingPools"],
    ["orchestrator", "pools"],
  ] as const,
  positions: [
    ["userBorrowPosition"],
    ["userLendingBTokens"],
    ["health-factor"],
    ["userCollateral"],
    ["borrowLimit"],
    ["backstopToken"],
    ["backstopWalletBalance"],
    ["backstopDeposit"],
  ] as const,
  rates: [
    ["borrowPools"],
    ["lendingPools"],
  ] as const,
};

function getKeysForScopes(scopes: readonly InvalidationScope[]): readonly (readonly string[])[] {
  const seen = new Set<string>();
  const keys: (readonly string[])[] = [];

  for (const scope of scopes) {
    if (scope === "all") {
      for (const s of Object.values(SCOPE_KEYS)) {
        for (const key of s) {
          const serialised = JSON.stringify(key);
          if (!seen.has(serialised)) {
            seen.add(serialised);
            keys.push(key);
          }
        }
      }
    } else if (scope in SCOPE_KEYS) {
      for (const key of SCOPE_KEYS[scope]) {
        const serialised = JSON.stringify(key);
        if (!seen.has(serialised)) {
          seen.add(serialised);
          keys.push(key);
        }
      }
    }
  }

  return keys;
}

export async function invalidateProtocolQueries(
  queryClient: QueryClient,
  scopes: InvalidationScope[] = ["all"]
): Promise<void> {
  const keys = getKeysForScopes(scopes);

  await Promise.all(
    keys.map((key) => queryClient.invalidateQueries({ queryKey: key as string[] }))
  );
}
