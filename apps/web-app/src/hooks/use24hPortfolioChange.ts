import type { Horizon } from "@stellar/stellar-sdk";

type MappedBalances = Record<string, Horizon.HorizonApi.BalanceLine>;

export function use24hPortfolioChange(_balances: MappedBalances) {
  return {
    change: null as string | null,
    isPositive: null as boolean | null,
    isLoading: false,
  };
}
