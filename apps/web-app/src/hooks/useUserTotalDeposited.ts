import { useQuery } from "@tanstack/react-query";
import { orchestrator } from "@/lib/orchestrator";

const COINGECKO_IDS: Record<string, string> = {
  XLM: "stellar",
  USDC: "usd-coin",
};

async function fetchTotalDeposited(userAddress: string) {
  const pools = await orchestrator.getAllPools();

  const positionResults = await Promise.allSettled(
    pools.map((pool) => orchestrator.getUserPosition(pool.id, userAddress))
  );

  const activePositions = pools.flatMap((pool, i) => {
    const result = positionResults[i];
    if (result.status !== "fulfilled") return [];
    const position = result.value;
    if (position.deposited === 0n) return [];
    const token = pool.tokens[0];
    if (!token) return [];
    return [{ pool, position, token }];
  });

  if (activePositions.length === 0) {
    return { totalUsd: 0, positionCount: 0 };
  }

  const tokenCodes = [...new Set(activePositions.map((p) => p.token.code))];
  const cgIds = tokenCodes.flatMap((code) => {
    const id = COINGECKO_IDS[code];
    return id ? [id] : [];
  });

  let prices: Record<string, { usd: number }> = {};
  if (cgIds.length > 0) {
    const res = await fetch(
      `/api/coingecko/price?ids=${cgIds.join(",")}&vs_currencies=usd`
    );
    if (res.ok) prices = await res.json();
  }

  let totalUsd = 0;
  for (const { position, token } of activePositions) {
    const cgId = COINGECKO_IDS[token.code];
    const price = cgId ? prices[cgId]?.usd : undefined;
    if (!price) continue;
    const amount = Number(position.deposited) / Math.pow(10, token.decimals);
    totalUsd += amount * price;
  }

  return { totalUsd, positionCount: activePositions.length };
}

/**
 * Returns the total USD value the user has deposited across all protocol pools.
 * Only counts positions with deposited > 0 and tokens with a known CoinGecko ID.
 */
export function useUserTotalDeposited(userAddress: string | undefined) {
  return useQuery({
    queryKey: ["userTotalDeposited", userAddress],
    queryFn: () => fetchTotalDeposited(userAddress!),
    enabled: !!userAddress,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
