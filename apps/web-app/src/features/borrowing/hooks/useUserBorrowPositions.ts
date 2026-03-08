import { useQueries } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { Client as RwaLendingClient } from "@neko/lending";
import {
  rpcUrl,
  networkPassphrase,
  allowHttpForSoroban,
} from "@/lib/constants/network";
import { formatAmount } from "@/lib/helpers/formatUtils";
import { useBorrowPools } from "./useBorrowPools";

const SCALAR_12 = 1_000_000_000_000n;
const STELLAR_DECIMALS = 7;

export interface BorrowPosition {
  assetCode: string;
  collateralTokenCode: string;
  contractId: string;
  dTokens: bigint;
  dTokensFormatted: string;
  dRate: bigint;
  debtRaw: bigint;
  debtFormatted: string;
  interestRate: number;
}

async function fetchDebt(
  assetCode: string,
  walletAddress: string,
  contractId: string
): Promise<{ dTokens: bigint; dRate: bigint }> {
  const client = new RwaLendingClient({
    contractId,
    rpcUrl,
    networkPassphrase,
    ...(allowHttpForSoroban && { allowHttp: true }),
  });

  const [dTokensTx, dRateTx] = await Promise.all([
    client.get_d_token_balance(
      { borrower: walletAddress, asset: assetCode },
      { simulate: true }
    ),
    client.get_d_token_rate({ asset: assetCode }, { simulate: true }),
  ]);

  const dTokens =
    dTokensTx.result != null ? BigInt(String(dTokensTx.result)) : 0n;
  const dRate = dRateTx.result != null ? BigInt(String(dRateTx.result)) : 0n;
  return { dTokens, dRate };
}

export function useUserBorrowPositions() {
  const { address } = useWallet();
  const { data: pools = [], isLoading: poolsLoading } = useBorrowPools();

  // Deduplicate by assetCode — debt is per-asset, not per-pool
  // Keep contractId so we query the right pool contract
  const uniqueAssets = pools.reduce<
    Record<
      string,
      {
        assetCode: string;
        collateralTokenCode: string;
        interestRate: number;
        contractId: string;
      }
    >
  >((acc, pool) => {
    if (!acc[pool.assetCode]) {
      acc[pool.assetCode] = {
        assetCode: pool.assetCode,
        collateralTokenCode: pool.collateralTokenCode,
        interestRate: pool.interestRate,
        contractId: pool.contractId,
      };
    }
    return acc;
  }, {});

  const assets = Object.values(uniqueAssets);

  const debtQueries = useQueries({
    queries: assets.map((a) => ({
      queryKey: ["userBorrowDebt", a.assetCode, a.contractId, address],
      queryFn: () => fetchDebt(a.assetCode, address!, a.contractId),
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
        : formatAmount(Number(debtRaw) / 10 ** STELLAR_DECIMALS);
    const dTokensFormatted = formatAmount(
      Number(dTokens) / 10 ** STELLAR_DECIMALS
    );

    positions.push({
      assetCode: asset.assetCode,
      collateralTokenCode: asset.collateralTokenCode,
      contractId: asset.contractId,
      dTokens,
      dTokensFormatted,
      dRate,
      debtRaw,
      debtFormatted,
      interestRate: asset.interestRate,
    });
  });

  return { positions, isLoading, hasWallet: Boolean(address) };
}
