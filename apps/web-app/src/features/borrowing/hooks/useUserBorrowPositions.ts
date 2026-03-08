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
  collateralToken: string;
  contractId: string;
  dTokens: bigint;
  dTokensFormatted: string;
  dRate: bigint;
  debtRaw: bigint;
  debtFormatted: string;
  collateralRaw: bigint;
  collateralFormatted: string;
  interestRate: number;
}

async function fetchPositionData(
  assetCode: string,
  collateralToken: string,
  walletAddress: string,
  contractId: string
): Promise<{ dTokens: bigint; dRate: bigint; collateral: bigint }> {
  const client = new RwaLendingClient({
    contractId,
    rpcUrl,
    networkPassphrase,
    ...(allowHttpForSoroban && { allowHttp: true }),
  });

  const [dTokensTx, dRateTx, collateralTx] = await Promise.all([
    client.get_d_token_balance(
      { borrower: walletAddress, asset: assetCode },
      { simulate: true }
    ),
    client.get_d_token_rate({ asset: assetCode }, { simulate: true }),
    client.get_collateral(
      { borrower: walletAddress, rwa_token: collateralToken },
      { simulate: true }
    ),
  ]);

  const dTokens =
    dTokensTx.result != null ? BigInt(String(dTokensTx.result)) : 0n;
  const dRate = dRateTx.result != null ? BigInt(String(dRateTx.result)) : 0n;
  const collateral =
    collateralTx.result != null ? BigInt(String(collateralTx.result)) : 0n;

  return { dTokens, dRate, collateral };
}

export function useUserBorrowPositions() {
  const { address } = useWallet();
  const { data: pools = [], isLoading: poolsLoading } = useBorrowPools();

  // Deduplicate by assetCode — debt is per-asset, not per-pool
  const uniqueAssets = pools.reduce<
    Record<
      string,
      {
        assetCode: string;
        collateralTokenCode: string;
        collateralToken: string;
        interestRate: number;
        contractId: string;
      }
    >
  >((acc, pool) => {
    if (!acc[pool.assetCode]) {
      acc[pool.assetCode] = {
        assetCode: pool.assetCode,
        collateralTokenCode: pool.collateralTokenCode,
        collateralToken: pool.collateralToken,
        interestRate: pool.interestRate,
        contractId: pool.contractId,
      };
    }
    return acc;
  }, {});

  const assets = Object.values(uniqueAssets);

  const positionQueries = useQueries({
    queries: assets.map((a) => ({
      queryKey: [
        "userBorrowPosition",
        a.assetCode,
        a.contractId,
        a.collateralToken,
        address,
      ],
      queryFn: () =>
        fetchPositionData(
          a.assetCode,
          a.collateralToken,
          address!,
          a.contractId
        ),
      enabled: Boolean(address) && assets.length > 0,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const isLoading =
    poolsLoading ||
    (Boolean(address) && positionQueries.some((q) => q.isLoading));

  const positions: BorrowPosition[] = [];

  positionQueries.forEach((q, i) => {
    if (!q.data) return;
    const { dTokens, dRate, collateral } = q.data;
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
    const collateralFormatted = formatAmount(
      Number(collateral) / 10 ** STELLAR_DECIMALS
    );

    positions.push({
      assetCode: asset.assetCode,
      collateralTokenCode: asset.collateralTokenCode,
      collateralToken: asset.collateralToken,
      contractId: asset.contractId,
      dTokens,
      dTokensFormatted,
      dRate,
      debtRaw,
      debtFormatted,
      collateralRaw: collateral,
      collateralFormatted,
      interestRate: asset.interestRate,
    });
  });

  return { positions, isLoading, hasWallet: Boolean(address) };
}
