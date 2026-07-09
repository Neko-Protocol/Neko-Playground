"use client";

import { useState, useMemo, useCallback } from "react";
import { useBorrowPools } from "./useBorrowPools";
import { useBorrowExecution } from "./useBorrowExecution";
import { poolsToTableAssets } from "../utils/borrowUtils";
import { usePools, usePoolAction } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { formatLiquidity } from "@/lib/helpers/formatUtils";
import type { BorrowTableAsset } from "../types/borrowing";

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50] as const;

export function useBorrow() {
  const [selectedAsset, setSelectedAsset] = useState<BorrowTableAsset | null>(
    null
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const {
    data: borrowPools = [],
    isLoading: isLoadingNeko,
    error: nekoError,
  } = useBorrowPools();

  const {
    data: orchestratorPools = [],
    isLoading: isLoadingOrchestrator,
    error: orchestratorError,
  } = usePools();

  const { mutateAsync: executePoolAction } = usePoolAction();

  const {
    handleBorrow,
    isLoading: isProcessing,
    isWalletConnected,
  } = useBorrowExecution();

  const isLoading = isLoadingNeko || isLoadingOrchestrator;
  const poolsError = nekoError || orchestratorError;

  const assets = useMemo(() => {
    const nekoAssets = poolsToTableAssets(borrowPools);

    const aggregated: BorrowTableAsset[] = orchestratorPools
      .filter(
        (p: PoolInfo) =>
          p.type !== "neko" && p.supportedActions.includes("borrow")
      )
      .map((p: PoolInfo, i: number) => {
        const token = p.tokens[0];
        const decimals = token?.decimals ?? 7;
        const liquidity = formatLiquidity(
          fromSmallestUnit(p.tvl.toString(), decimals)
        );
        const borrowApy =
          typeof p.metadata.borrowApy === "number"
            ? p.metadata.borrowApy
            : p.apy;
        const contractId = p.id.split(":")[1] ?? p.id;
        return {
          id: `agg-borrow-${i}`,
          pool: {
            token1: token?.code ?? "?",
            token2: p.name,
            fee: "0%",
          },
          borrowApr: borrowApy > 0 ? `${borrowApy.toFixed(2)}%` : "0.00%",
          collateralFactorDisplay: "Aggregated",
          liquidity,
          isActive: p.state === "active",
          state: p.state,
          assetCode: token?.code ?? "?",
          collateralTokenCode: "",
          collateralFactor: 0,
          contractId,
          isAggregated: true,
          orchestratorId: p.id,
        };
      });

    return [...nekoAssets, ...aggregated];
  }, [borrowPools, orchestratorPools]);

  const totalRows = assets.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedAssets = assets.slice(
    page * rowsPerPage,
    (page + 1) * rowsPerPage
  );

  const openModal = useCallback((asset: BorrowTableAsset) => {
    setSelectedAsset(asset);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedAsset(null);
  }, []);

  const handleSubmit = useCallback(
    async (collateralAmount: string, borrowAmount: string) => {
      if (!selectedAsset) return;

      if (selectedAsset.isAggregated && selectedAsset.orchestratorId) {
        const decimals = 7;
        const rawAmount = BigInt(
          Math.floor(parseFloat(borrowAmount) * 10 ** decimals)
        );
        await executePoolAction({
          poolId: selectedAsset.orchestratorId,
          action: "borrow",
          amount: rawAmount,
        });
        closeModal();
        return;
      }

      const result = await handleBorrow({
        collateralTokenCode: selectedAsset.collateralTokenCode,
        assetCode: selectedAsset.assetCode,
        collateralAmount,
        borrowAmount,
        collateralDecimals: 7,
        borrowDecimals: 7,
        contractId: selectedAsset.contractId,
      });
      if (result?.success) closeModal();
    },
    [selectedAsset, handleBorrow, executePoolAction, closeModal]
  );

  const changeRowsPerPage = useCallback((value: number) => {
    setRowsPerPage(value);
    setPage(0);
  }, []);

  return {
    assets,
    paginatedAssets,
    isLoading,
    poolsError,
    selectedAsset,
    isProcessing,
    isWalletConnected: !!isWalletConnected,
    page,
    totalRows,
    totalPages,
    rowsPerPage,
    setPage,
    changeRowsPerPage,
    openModal,
    closeModal,
    handleSubmit,
  };
}
