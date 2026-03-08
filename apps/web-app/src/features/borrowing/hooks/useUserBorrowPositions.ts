import { useQueries } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { getDTokenBalance, getDTokenRate } from "@/lib/helpers/stellar/lending";
import { useBorrowPools } from "./useBorrowPools";

const SCALAR_12 = 1_000_000_000_000n;
const STELLAR_DECIMALS = 7;

export interface BorrowPosition {
  assetCode: string;
  collateralTokenCode: string;
  dTokens: bigint;
  dRate: bigint;
  debtRaw: bigint;
  debtFormatted: string;
  interestRate: number;
}

async function fetchDebt(
  assetCode: string,
  walletAddress: string
): Promise<{ dTokens: bigint; dRate: bigint }> {
  const [dTokens, dRate] = await Promise.all([
    getDTokenBalance(assetCode, walletAddress),
    getDTokenRate(assetCode),
  ]);
  return { dTokens, dRate };
}

export function useUserBorrowPositions() {
  const { address } = useWallet();
  const { data: pools = [], isLoading: poolsLoading } = useBorrowPools();

  // Deduplicate by assetCode — debt is per-asset, not per-pool
  const uniqueAssets = pools.reduce<
    Record<
      string,
      { assetCode: string; collateralTokenCode: string; interestRate: number }
    >
  >((acc, pool) => {
    if (!acc[pool.assetCode]) {
      acc[pool.assetCode] = {
        assetCode: pool.assetCode,
        collateralTokenCode: pool.collateralTokenCode,
        interestRate: pool.interestRate,
      };
    }
    return acc;
  }, {});

  const assets = Object.values(uniqueAssets);

  const debtQueries = useQueries({
    queries: assets.map((a) => ({
      queryKey: ["userBorrowDebt", a.assetCode, address],
      queryFn: () => fetchDebt(a.assetCode, address!),
      enabled: Boolean(address) && assets.length > 0,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const isLoading =
    poolsLoading || (Boolean(address) && debtQueries.some((q) => q.isLoading));

  const positions: BorrowPosition[] = [];

  debtQueries.forEach((q, i) => {
    if (!q.data) return;
    const { dTokens, dRate } = q.data;
    if (dTokens === 0n) return;

    const asset = assets[i];
    const debtRaw = dRate > 0n ? (dTokens * dRate) / SCALAR_12 : 0n;
    const debtFormatted =
      debtRaw === 0n
        ? "0"
        : (Number(debtRaw) / 10 ** STELLAR_DECIMALS).toFixed(4);

    positions.push({
      assetCode: asset.assetCode,
      collateralTokenCode: asset.collateralTokenCode,
      dTokens,
      dRate,
      debtRaw,
      debtFormatted,
      interestRate: asset.interestRate,
    });
  });

  return { positions, isLoading, hasWallet: Boolean(address) };
}
