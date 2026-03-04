"use client";

import { useState, useMemo, useCallback } from "react";
import { useBorrowPools } from "./useBorrowPools";
import { useBorrowExecution } from "./useBorrowExecution";
import { poolsToTableAssets } from "../utils/borrowUtils";
import type { BorrowTableAsset } from "../types/borrowing";

export const ROWS_PER_PAGE_OPTIONS = [10, 25, 50] as const;

export function useBorrow() {
  const [selectedAsset, setSelectedAsset] = useState<BorrowTableAsset | null>(
    null
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const {
    data: borrowPools = [],
    isLoading,
    error: poolsError,
  } = useBorrowPools();

  const {
    handleBorrow,
    isLoading: isProcessing,
    error: executionError,
    clearError,
    isWalletConnected,
  } = useBorrowExecution();

  const assets = useMemo(() => poolsToTableAssets(borrowPools), [borrowPools]);

  const totalRows = assets.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage);
  const paginatedAssets = assets.slice(
    page * rowsPerPage,
    (page + 1) * rowsPerPage
  );

  const openModal = useCallback(
    (asset: BorrowTableAsset) => {
      setSelectedAsset(asset);
      setSuccess(null);
      clearError();
    },
    [clearError]
  );

  const closeModal = useCallback(() => {
    setSelectedAsset(null);
    setSuccess(null);
    clearError();
  }, [clearError]);

  const handleSubmit = useCallback(
    async (collateralAmount: string, borrowAmount: string) => {
      if (!selectedAsset) return;
      const result = await handleBorrow({
        collateralTokenCode: selectedAsset.collateralTokenCode,
        assetCode: selectedAsset.assetCode,
        collateralAmount,
        borrowAmount,
        collateralDecimals: 7,
        borrowDecimals: 7,
      });
      if (result?.success && result.message) {
        setSuccess(result.message);
      }
    },
    [selectedAsset, handleBorrow]
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
    executionError,
    success,
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
    clearSuccess: () => setSuccess(null),
    clearError,
  };
}
