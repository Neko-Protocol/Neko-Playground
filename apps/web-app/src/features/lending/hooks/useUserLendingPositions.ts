import { useQueries } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { getBTokenBalanceRaw } from "@/lib/helpers/stellar/lending";
import { formatAmount } from "@/lib/helpers/formatUtils";
import { useLendingPools } from "./useLendingPools";

const STELLAR_DECIMALS = 7;

export interface LendingPosition {
  assetCode: string;
  bTokens: bigint;
  bTokensFormatted: string;
  bTokenRate: string;
  depositedFormatted: string;
  interestRate: number;
}

export function useUserLendingPositions() {
  const { address } = useWallet();
  const { data: pools = [], isLoading: poolsLoading } = useLendingPools();

  const balanceQueries = useQueries({
    queries: pools.map((pool) => ({
      queryKey: [
        "userLendingBTokens",
        pool.assetCode,
        pool.contractId,
        address,
      ],
      queryFn: () =>
        getBTokenBalanceRaw(pool.assetCode, address!, pool.contractId),
      enabled: Boolean(address) && pools.length > 0,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const isLoading =
    poolsLoading ||
    (Boolean(address) && balanceQueries.some((q) => q.isLoading));

  const positions: LendingPosition[] = [];

  balanceQueries.forEach((q, i) => {
    const bTokens = q.data ?? 0n;
    if (bTokens === 0n) return;

    const pool = pools[i];
    const bTokenRate = pool.bTokenRate ?? "1";
    const bTokensHuman = Number(bTokens) / 10 ** STELLAR_DECIMALS;
    const deposited = bTokensHuman * parseFloat(bTokenRate);

    positions.push({
      assetCode: pool.assetCode,
      bTokens,
      bTokensFormatted: formatAmount(bTokensHuman),
      bTokenRate,
      depositedFormatted: formatAmount(deposited),
      interestRate: pool.interestRate,
    });
  });

  return { positions, isLoading, hasWallet: Boolean(address) };
}
