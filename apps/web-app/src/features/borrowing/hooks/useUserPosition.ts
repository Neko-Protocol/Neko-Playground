"use client";

import { useQueries } from "@tanstack/react-query";
import { getContracts } from "@/lib/constants/contractsByNetwork";
import { lendingService } from "@/lib/services/lending.service";
import { getAssetsConfig } from "@/lib/constants/assets.config";

export type { LendingPosition, BorrowPosition, PoolHealthFactor };

const STELLAR_DECIMALS = 7;

const contracts = getContracts();

const POOLS = [
  {
    key: "pool1",
    contractId: contracts.lendingPool1,
    label: "Pool 1",
  },
  {
    key: "pool2",
    contractId: contracts.lendingPool2,
    label: "Pool 2",
  },
] as const;

export interface CollateralPosition {
  tokenCode: string;
  contract: string;
  raw: bigint;
  formatted: string;
}

export interface BorrowLimitEntry {
  key: string;
  label: string;
  limitUsd: number | null;
}

export interface UserPositionData {
  deposits: LendingPosition[];
  debts: BorrowPosition[];
  healthFactors: PoolHealthFactor[];
  collateral: CollateralPosition[];
  borrowLimits: BorrowLimitEntry[];
  isLoading: boolean;
  hasWallet: boolean;
}

export function useUserPosition(
  borrowerAddress: string | undefined
): UserPositionData {
  const { positions: deposits, isLoading: depositsLoading } =
    useUserLendingPositions();
  const {
    positions: debts,
    isLoading: debtsLoading,
    hasWallet,
  } = useUserBorrowPositions();
  const { pools: healthFactors, isLoading: hfLoading } =
    useHealthFactor(borrowerAddress);

  const rwaTokens = Object.values(getAssetsConfig()).filter(
    (a) => a.priceSource === "oracle"
  );

  const collateralQueries = useQueries({
    queries: rwaTokens.map((token) => ({
      queryKey: ["userCollateral", token.code, borrowerAddress],
      queryFn: () =>
        lendingService.getCollateralRaw(
          token.contract,
          borrowerAddress!,
          contracts.lendingPool1
        ),
      enabled: Boolean(borrowerAddress),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const borrowLimitQueries = useQueries({
    queries: POOLS.map((pool) => ({
      queryKey: ["borrowLimit", pool.key, borrowerAddress],
      queryFn: () =>
        lendingService.getBorrowLimitForPool(borrowerAddress!, pool.contractId),
      enabled: Boolean(borrowerAddress),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    })),
  });

  const isLoading =
    depositsLoading ||
    debtsLoading ||
    hfLoading ||
    (Boolean(borrowerAddress) && collateralQueries.some((q) => q.isLoading)) ||
    (Boolean(borrowerAddress) && borrowLimitQueries.some((q) => q.isLoading));

  const collateral: CollateralPosition[] = [];
  collateralQueries.forEach((q, i) => {
    const raw = q.data ?? 0n;
    if (raw === 0n) return;
    const token = rwaTokens[i];
    collateral.push({
      tokenCode: token.code,
      contract: token.contract,
      raw,
      formatted: (Number(raw) / 10 ** STELLAR_DECIMALS).toFixed(
        STELLAR_DECIMALS
      ),
    });
  });

  const borrowLimits: BorrowLimitEntry[] = POOLS.map((pool, i) => ({
    key: pool.key,
    label: pool.label,
    limitUsd: borrowLimitQueries[i].data ?? null,
  }));

  return {
    deposits,
    debts,
    healthFactors,
    collateral,
    borrowLimits,
    isLoading,
    hasWallet,
  };
}
