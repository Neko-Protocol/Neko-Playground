import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { clearUserScopedQueries, isGlobalQueryKey } from "../userScopedQueries";

const ADDRESS = "GPREVIOUSWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";

// The five keys issue #311 documents as having survived the old
// hand-maintained list, plus a sample of what that list did cover, plus a
// key no list has ever heard of (the case the inverted invariant exists for).
const USER_SCOPED_KEYS = [
  ["kyc-status", "etherfuse", "cust_1", ADDRESS],
  ["fiat-accounts", "etherfuse", "cust_1"],
  ["etherfuse-assets", "etherfuse", ADDRESS],
  ["portfolioBackstopDeposit", "CCONTRACT", ADDRESS],
  ["analytics-earnings", ADDRESS, "30d"],
  ["vault", "invest-history"],
  ["stellar-balances", ADDRESS],
  ["tokenBalance", "CTOKEN", ADDRESS],
  ["health-factor", "poolKey", ADDRESS],
  ["userDebt", "USDC", ADDRESS],
  ["orchestrator", "position", "pool-1", ADDRESS],
  ["brand-new-hook-nobody-registered", ADDRESS],
];

const GLOBAL_KEYS = [
  ["lendingPools"],
  ["borrowPools"],
  ["oracle", "prices", "XLM"],
  ["orchestrator", "pool", "pool-1"],
  ["orchestrator", "pools"],
  ["portfolioPrice", "CETES"],
  ["tokenPrice", "USDC", "CTOKEN"],
  ["vaultData", "CVAULT"],
  ["vault-invest-status"],
  ["portfolioBackstopToken", "CCONTRACT"],
  ["bad-debt-auctions", "CCONTRACT"],
];

function seededClient(): QueryClient {
  const queryClient = new QueryClient();
  for (const key of [...USER_SCOPED_KEYS, ...GLOBAL_KEYS]) {
    queryClient.setQueryData(key, { fromPreviousWallet: true });
  }
  return queryClient;
}

describe("clearUserScopedQueries", () => {
  it("removes every user-scoped entry, including customerId-keyed ramp queries", () => {
    const queryClient = seededClient();
    clearUserScopedQueries(queryClient);
    for (const key of USER_SCOPED_KEYS) {
      expect(queryClient.getQueryData(key), key.join("/")).toBeUndefined();
    }
  });

  it("keeps genuinely global caches so disconnect does not force a full refetch storm", () => {
    const queryClient = seededClient();
    clearUserScopedQueries(queryClient);
    for (const key of GLOBAL_KEYS) {
      expect(queryClient.getQueryData(key), key.join("/")).toEqual({
        fromPreviousWallet: true,
      });
    }
  });

  it("leaves no residual entry that is not provably global", () => {
    const queryClient = seededClient();
    clearUserScopedQueries(queryClient);
    const remaining = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey);
    expect(remaining.length).toBe(GLOBAL_KEYS.length);
    expect(remaining.every((key) => isGlobalQueryKey(key))).toBe(true);
  });
});

describe("isGlobalQueryKey", () => {
  it("matches prefixes positionally, not by first segment alone", () => {
    expect(isGlobalQueryKey(["orchestrator", "pool", "p1"])).toBe(true);
    expect(isGlobalQueryKey(["orchestrator", "position", "p1", ADDRESS])).toBe(
      false
    );
  });

  it("treats unknown keys as user-scoped by default", () => {
    expect(isGlobalQueryKey(["some-future-feature", "anything"])).toBe(false);
    expect(isGlobalQueryKey([])).toBe(false);
  });
});
