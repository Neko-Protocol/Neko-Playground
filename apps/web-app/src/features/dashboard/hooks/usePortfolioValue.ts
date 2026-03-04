import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { stellarPriceService } from "@/lib/services/stellar-price.service";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap/tokens";
import { parseBalance } from "@/lib/helpers/formatUtils";
import { RWA_TOKENS } from "@/lib/constants/wallet";

export interface PortfolioHolding {
  code: string;
  balance: number;
  priceUsd: number;
  valueUsd: number;
}

interface PortfolioValue {
  totalUsd: number;
  holdings: PortfolioHolding[];
  isLoading: boolean;
  error: Error | null;
}

async function resolvePrice(code: string): Promise<number> {
  if (RWA_TOKENS.includes(code)) {
    const tokens = getAvailableTokens();
    const tokenInfo = tokens[code];
    if (!tokenInfo) return 0;
    return stellarPriceService.getRWAOraclePrice(tokenInfo.contract);
  }
  return stellarPriceService.getTokenPrice(code);
}

export function usePortfolioValue(): PortfolioValue {
  const { balances, address, isFetchingBalances } = useWallet();

  const balanceEntries = Object.entries(balances)
    .map(([key, bal]) => {
      let code: string | null = null;
      if (bal.asset_type === "native") {
        code = "XLM";
      } else if (bal.asset_type === "liquidity_pool_shares") {
        code = null;
      } else if ("asset_code" in bal && bal.asset_code) {
        code = bal.asset_code;
      }
      return { key, code, rawBalance: bal.balance };
    })
    .filter((e): e is { key: string; code: string; rawBalance: string } =>
      e.code !== null && parseBalance(e.rawBalance) > 0
    );

  const balanceKey = balanceEntries
    .map((e) => `${e.code}:${e.rawBalance}`)
    .sort()
    .join("|");

  const {
    data: holdings = [],
    isLoading: isLoadingPrices,
    error,
  } = useQuery<PortfolioHolding[]>({
    queryKey: ["portfolio-value", address, balanceKey],
    queryFn: async () => {
      const results = await Promise.allSettled(
        balanceEntries.map(async (entry) => {
          const balance = parseBalance(entry.rawBalance);
          const priceUsd = await resolvePrice(entry.code);
          return {
            code: entry.code,
            balance,
            priceUsd,
            valueUsd: balance * priceUsd,
          };
        })
      );

      return results
        .filter(
          (r): r is PromiseFulfilledResult<PortfolioHolding> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value)
        .sort((a, b) => b.valueUsd - a.valueUsd);
    },
    enabled: Boolean(address) && balanceEntries.length > 0,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const totalUsd = holdings.reduce((sum, h) => sum + h.valueUsd, 0);

  return {
    totalUsd,
    holdings,
    isLoading: isFetchingBalances || isLoadingPrices,
    error: error as Error | null,
  };
}
