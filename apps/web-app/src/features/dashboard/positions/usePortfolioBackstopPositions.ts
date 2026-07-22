"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { networks as backstopNetworks } from "@neko/backstop";
import { useWallet } from "@/hooks/useWallet";
import {
  getBackstopToken,
  getBackstopDeposit,
} from "@/lib/helpers/stellar/lending";
import { getContractToCodeMap } from "@/lib/constants/assets.config";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";

const STELLAR_DECIMALS = 7;

/**
 * The two backstops mirror the pools they protect (see BackstopPanel) — each
 * lending pool has its own backstop contract, distinct from the token
 * contract deposited into it, which is only known at runtime via
 * `get_backstop_token`.
 */
const BACKSTOP_POOLS = [
  {
    key: "pool1",
    label: "Crypto Pool",
    contractId: backstopNetworks.testnet.pool1ContractId,
  },
  {
    key: "pool2",
    label: "RWA Pool",
    contractId: backstopNetworks.testnet.pool2ContractId,
  },
] as const;

export interface BackstopPositionRaw {
  key: string;
  label: string;
  amount: number;
  assetCode: string | null;
}

/** Read-only aggregation of the caller's deposits across every backstop. */
export function usePortfolioBackstopPositions() {
  const { address } = useWallet();

  const tokenQueries = useQueries({
    queries: BACKSTOP_POOLS.map((pool) => ({
      queryKey: ["portfolioBackstopToken", pool.contractId],
      queryFn: () => getBackstopToken(pool.contractId),
      staleTime: 10 * 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const depositQueries = useQueries({
    queries: BACKSTOP_POOLS.map((pool) => ({
      queryKey: ["portfolioBackstopDeposit", pool.contractId, address],
      queryFn: () => getBackstopDeposit(address!, pool.contractId),
      enabled: Boolean(address),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const isLoading =
    tokenQueries.some((q) => q.isLoading) ||
    (Boolean(address) && depositQueries.some((q) => q.isLoading));

  const positions: BackstopPositionRaw[] = useMemo(() => {
    const contractToCode = getContractToCodeMap();
    const result: BackstopPositionRaw[] = [];

    BACKSTOP_POOLS.forEach((pool, i) => {
      const deposit = depositQueries[i]?.data;
      if (!deposit || deposit.amount === 0n) return;

      const tokenAddress = tokenQueries[i]?.data ?? null;
      const assetCode = tokenAddress
        ? (contractToCode[tokenAddress] ?? null)
        : null;

      result.push({
        key: pool.key,
        label: pool.label,
        amount: Number(
          fromSmallestUnit(deposit.amount.toString(), STELLAR_DECIMALS)
        ),
        assetCode,
      });
    });

    return result;
  }, [depositQueries, tokenQueries]);

  return { positions, isLoading, hasWallet: Boolean(address) };
}
