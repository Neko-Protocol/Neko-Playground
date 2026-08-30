"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useUserLendingPositions } from "@/features/lending/hooks/useUserLendingPositions";
import { useUserBorrowPositions } from "@/features/borrowing/hooks/useUserBorrowPositions";
import { useVaultBalance } from "@/features/vault/hooks/useVaultBalance";
import { useVaultData } from "@/features/vault/hooks/useVaultData";
import { VAULT_REGISTRY } from "@/features/vault/const/vaults";
import { getAssetsConfig } from "@/lib/constants/assets.config";
import { stellarPriceService } from "@/lib/services/stellar-price.service";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { usePortfolioValue } from "./usePortfolioValue";
import { useUserPositions } from "./useUserPositions";
import {
  aggregatePortfolio,
  normalizeBackstopPositions,
  normalizeBorrowPositions,
  normalizeLendingPositions,
  normalizeLeveragePositions,
  normalizePoolPositions,
  normalizeVaultPosition,
  normalizeWalletHoldings,
  type PriceLookup,
} from "../positions/normalize";
import { usePortfolioBackstopPositions } from "../positions/usePortfolioBackstopPositions";
import {
  computeLeveragePositionSummary,
  useLeverageStrategies,
} from "../positions/leverage";
import type { PortfolioSummary } from "../positions/types";

const ONE_SHARE = 1_000_000_000_000n;
const STELLAR_DECIMALS = 7;

const VAULT_SUPPLY_ASSET_CODE =
  VAULT_REGISTRY["neko-usdc-cetes"]?.supplyAsset.symbol ?? "USDC";

/**
 * Cross-protocol portfolio engine: aggregates the wallet's spot balances
 * with its lending, borrowing, pool, vault and backstop positions into one
 * normalized view with a single net-worth figure (assets minus debt).
 *
 * Composes the existing per-feature hooks rather than re-fetching their
 * data — each one already owns the caching/staleTime tuned for its own
 * protocol; this only normalizes and combines what they return.
 */
export function useUnifiedPositions(): PortfolioSummary {
  const { address } = useWallet();

  const { holdings, isLoading: walletLoading } = usePortfolioValue();
  const { positions: poolPositions, isLoading: poolsLoading } =
    useUserPositions();
  const { positions: lendingPositions, isLoading: lendingLoading } =
    useUserLendingPositions();
  const { positions: borrowPositions, isLoading: borrowLoading } =
    useUserBorrowPositions();
  const { userShares, isLoading: vaultBalanceLoading } = useVaultBalance();
  const { data: vaultData, isLoading: vaultDataLoading } = useVaultData();
  const { positions: backstopPositions, isLoading: backstopLoading } =
    usePortfolioBackstopPositions();
  const { strategies: leverageStrategies } = useLeverageStrategies(address);

  const vaultQuantity = useMemo(() => {
    if (!vaultData || userShares <= 0n) return 0;
    const underlyingRaw = (userShares * vaultData.pricePerShare) / ONE_SHARE;
    return Number(fromSmallestUnit(underlyingRaw.toString(), STELLAR_DECIMALS));
  }, [vaultData, userShares]);

  // Every asset code that needs a USD price beyond wallet holdings, which
  // already carry their own priceUsd from usePortfolioValue.
  const codesToPrice = useMemo(() => {
    const codes = new Set<string>();
    lendingPositions.forEach((p) => codes.add(p.assetCode));
    borrowPositions.forEach((p) => {
      codes.add(p.assetCode);
      codes.add(p.collateralTokenCode);
    });
    poolPositions.forEach(({ pool }) => {
      if (pool.type === "blend" || pool.type === "neko") {
        const code = pool.tokens[0]?.code;
        if (code) codes.add(code);
      }
    });
    if (vaultQuantity > 0) codes.add(VAULT_SUPPLY_ASSET_CODE);
    backstopPositions.forEach((p) => {
      if (p.assetCode) codes.add(p.assetCode);
    });
    leverageStrategies.forEach(({ meta }) => {
      codes.add(meta.assetCode);
      codes.add(meta.borrowAssetCode);
    });
    return Array.from(codes);
  }, [
    lendingPositions,
    borrowPositions,
    poolPositions,
    vaultQuantity,
    backstopPositions,
    leverageStrategies,
  ]);

  const assetsConfig = getAssetsConfig();
  const priceQueries = useQueries({
    queries: codesToPrice.map((code) => ({
      queryKey: ["portfolioPrice", code],
      queryFn: () =>
        stellarPriceService.getPrice(code, assetsConfig[code]?.contract),
      staleTime: 15_000,
      gcTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    })),
  });

  const getPrice: PriceLookup = useMemo(() => {
    const priceMap = new Map<string, number>();
    codesToPrice.forEach((code, i) => {
      const value = priceQueries[i]?.data;
      if (typeof value === "number" && value > 0) priceMap.set(code, value);
    });
    return (code: string) => priceMap.get(code) ?? null;
  }, [codesToPrice, priceQueries]);

  const positions = useMemo(() => {
    return [
      ...normalizeWalletHoldings(holdings),
      ...normalizePoolPositions(poolPositions, getPrice),
      ...normalizeLendingPositions(lendingPositions, getPrice),
      ...normalizeBorrowPositions(borrowPositions, getPrice),
      ...normalizeVaultPosition(
        vaultQuantity > 0
          ? {
              quantity: vaultQuantity,
              supplyAssetCode: VAULT_SUPPLY_ASSET_CODE,
              apy: null,
            }
          : null,
        getPrice
      ),
      ...normalizeBackstopPositions(backstopPositions, getPrice),
      ...normalizeLeveragePositions(
        leverageStrategies.map(({ id, name, meta }) =>
          computeLeveragePositionSummary(id, name, meta, getPrice)
        )
      ),
    ];
  }, [
    holdings,
    poolPositions,
    lendingPositions,
    borrowPositions,
    vaultQuantity,
    backstopPositions,
    leverageStrategies,
    getPrice,
  ]);

  const isLoading =
    walletLoading ||
    poolsLoading ||
    lendingLoading ||
    borrowLoading ||
    vaultBalanceLoading ||
    vaultDataLoading ||
    backstopLoading ||
    priceQueries.some((q) => q.isLoading);

  return aggregatePortfolio(positions, isLoading, Boolean(address));
}
