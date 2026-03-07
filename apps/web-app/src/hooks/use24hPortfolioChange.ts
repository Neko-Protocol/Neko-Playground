import { useQuery } from "@tanstack/react-query";
import type { Horizon } from "@stellar/stellar-sdk";

type MappedBalances = Record<string, Horizon.HorizonApi.BalanceLine>;

const COINGECKO_IDS: Record<string, string> = {
  XLM: "stellar",
  USDC: "usd-coin",
};

async function fetch24hChanges(
  ids: string[]
): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  const res = await fetch(
    `/api/coingecko/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`
  );
  if (!res.ok) throw new Error("Failed to fetch 24h change");
  return res.json();
}

export function use24hPortfolioChange(balances: MappedBalances) {
  const entries = Object.values(balances).flatMap((b) => {
    let code: string | null = null;
    if (b.asset_type === "native") {
      code = "XLM";
    } else if (
      b.asset_type === "credit_alphanum4" ||
      b.asset_type === "credit_alphanum12"
    ) {
      const assetCode = b.asset_code;
      if (assetCode && assetCode in COINGECKO_IDS) code = assetCode;
    }
    if (!code) return [];
    const amount = parseFloat(b.balance.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) return [];
    return [{ code, cgId: COINGECKO_IDS[code], amount }];
  });

  const ids = [...new Set(entries.map((e) => e.cgId))];
  const hasBalances = entries.length > 0;

  const { data, isLoading } = useQuery({
    queryKey: ["portfolio24hChange", ids.sort().join(",")],
    queryFn: () => fetch24hChanges(ids),
    enabled: hasBalances && ids.length > 0,
    staleTime: 60000,
    refetchInterval: 60000,
    retry: 2,
  });

  if (!data || !hasBalances) return { change: null, isLoading };

  let totalUsdValue = 0;
  let weightedChange = 0;

  for (const entry of entries) {
    const tokenData = data[entry.cgId];
    if (!tokenData?.usd || tokenData.usd_24h_change == null) continue;
    const usdValue = entry.amount * tokenData.usd;
    totalUsdValue += usdValue;
    weightedChange += usdValue * tokenData.usd_24h_change;
  }

  if (totalUsdValue === 0) return { change: null, isLoading };

  const pct = weightedChange / totalUsdValue;
  const sign = pct >= 0 ? "+" : "";
  return {
    change: `${sign}${pct.toFixed(2)}%`,
    isPositive: pct >= 0,
    isLoading,
  };
}
