"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import {
  Hash,
  Layers,
  TrendingDown,
  Shield,
  Droplets,
  Zap,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  X,
  Info,
} from "lucide-react";
import { useBorrowPools } from "@/features/borrowing/hooks/useBorrowPools";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";
import { useBorrowExecution } from "@/features/borrowing/hooks/useBorrowExecution";
import {
  poolsToTableAssets,
  calculateBorrowLimit,
} from "@/features/borrowing/utils/borrowUtils";
import type { BorrowTableAsset } from "@/features/borrowing/types/borrowing";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function IdBadge({ id, isActive }: { id: string; isActive: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isActive ? "text-[#76C464]" : "bg-white/5 text-white/40"
      }`}
      style={
        isActive ? { backgroundColor: "rgba(118,196,100,0.30)" } : undefined
      }
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-[#76C464]" : "bg-white/20"}`}
      />
      {id}
    </span>
  );
}

function TokenAvatar({ code }: { code: string }) {
  const icon = getTokenIcon({ type: "contract", code });
  return (
    <div className="h-6 w-6 rounded-full border-2 border-[#1C1C1C] bg-[#1a2a4a] flex items-center justify-center overflow-hidden">
      {icon ? (
        <Image src={icon} alt={code} width={14} height={14} unoptimized />
      ) : (
        <span className="text-white text-[9px] font-bold">{code[0]}</span>
      )}
    </div>
  );
}

function PoolCell({
  token1,
  token2,
  fee,
}: {
  token1: string;
  token2: string;
  fee: string;
}) {
  return (
    <div className="flex items-center gap-3">
      {/* Overlapping token icons */}
      <div className="relative w-9 h-6 shrink-0">
        <div className="absolute left-0 top-0">
          <TokenAvatar code={token1} />
        </div>
        <div className="absolute left-3.5 top-0">
          <TokenAvatar code={token2} />
        </div>
      </div>
      <span className="text-white font-medium text-sm">
        {token1}/{token2}
      </span>
      <span className="rounded-full bg-[#2F2F2F] px-2 py-0.5 text-xs font-semibold text-white/50">
        {fee}
      </span>
    </div>
  );
}

function ColHeader({
  icon: Icon,
  label,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  tooltip?: string;
}) {
  return (
    <th className="px-4 py-3 text-left">
      <div className="flex items-center gap-1.5 text-white/40 text-xs font-semibold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
        {tooltip && (
          <div className="group relative">
            <Info className="h-3 w-3 cursor-help" />
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block w-48 rounded-lg bg-[#2A2A2A] px-2 py-1 text-[10px] text-white/70 shadow-xl">
              {tooltip}
            </div>
          </div>
        )}
      </div>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Borrow Modal
// ---------------------------------------------------------------------------

interface BorrowModalProps {
  asset: BorrowTableAsset;
  isOpen: boolean;
  onClose: () => void;
  isProcessing: boolean;
  error: string | null;
  success: string | null;
  onClearError: () => void;
  onClearSuccess: () => void;
  onSubmit: (collateral: string, borrow: string) => Promise<void>;
  isWalletConnected: boolean;
}

function BorrowModal({
  asset,
  isOpen,
  onClose,
  isProcessing,
  error,
  success,
  onClearError,
  onClearSuccess,
  onSubmit,
  isWalletConnected,
}: BorrowModalProps) {
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");

  const borrowLimit = useMemo(() => {
    if (!collateralAmount) return 0;
    return calculateBorrowLimit(
      parseFloat(collateralAmount),
      asset.collateralFactor
    );
  }, [collateralAmount, asset.collateralFactor]);

  const borrowLimitExceeded =
    parseFloat(borrowAmount) > borrowLimit && borrowAmount !== "";
  const canSubmit =
    isWalletConnected &&
    Number.isFinite(parseFloat(collateralAmount)) &&
    parseFloat(collateralAmount) > 0 &&
    Number.isFinite(parseFloat(borrowAmount)) &&
    parseFloat(borrowAmount) > 0 &&
    !borrowLimitExceeded;

  const handleSubmit = async () => {
    await onSubmit(collateralAmount, borrowAmount);
    setCollateralAmount("");
    setBorrowAmount("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white text-xl font-bold">
            Borrow {asset.assetCode}
          </h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-red-400 text-sm flex-1">{error}</p>
            <button
              onClick={onClearError}
              className="text-red-400/60 hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-green-500/10 border border-green-500/20 p-3">
            <p className="text-green-400 text-sm flex-1">{success}</p>
            <button
              onClick={onClearSuccess}
              className="text-green-400/60 hover:text-green-400"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Collateral info */}
        <div className="mb-4 rounded-2xl bg-white/5 p-4">
          <p className="text-white/40 text-xs mb-1">Collateral Token</p>
          <p className="text-white font-semibold text-lg">
            {asset.collateralTokenCode}
          </p>
          <p className="text-white/30 text-xs mt-0.5">
            Collateral Factor: {asset.collateralFactor}%
          </p>
        </div>

        {/* Collateral amount */}
        <div className="mb-4">
          <label className="text-white/60 text-sm font-medium block mb-1.5">
            Collateral Amount ({asset.collateralTokenCode})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={collateralAmount}
            onChange={(e) => setCollateralAmount(e.target.value)}
            disabled={isProcessing}
            className="w-full bg-[#2A2A2A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Borrow limit */}
        <div className="mb-4 rounded-2xl bg-[#229EDF]/10 border border-[#229EDF]/20 p-4">
          <p className="text-[#229EDF]/70 text-xs">Your Borrow Limit</p>
          <p className="text-[#229EDF] font-bold text-2xl">
            {borrowLimit.toFixed(2)} {asset.assetCode}
          </p>
        </div>

        {/* Borrow amount */}
        <div className="mb-6">
          <label className="text-white/60 text-sm font-medium block mb-1.5">
            Borrow Amount ({asset.assetCode})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(e.target.value)}
            disabled={isProcessing}
            className="w-full bg-[#2A2A2A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
          />
          {borrowLimitExceeded && (
            <p className="text-red-400 text-xs mt-1">
              Amount exceeds your borrow limit
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 rounded-xl border border-white/10 py-3 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !canSubmit}
            className="flex-1 rounded-xl bg-[#229EDF] py-3 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing
              ? "Processing…"
              : !isWalletConnected
                ? "Connect Wallet"
                : "Borrow"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main table
// ---------------------------------------------------------------------------

const BorrowTable: React.FC = () => {
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

  const handleBorrowClick = (asset: BorrowTableAsset) => {
    setSelectedAsset(asset);
    setSuccess(null);
    clearError();
  };

  const handleCloseModal = () => {
    setSelectedAsset(null);
    setSuccess(null);
    clearError();
  };

  const handleSubmit = async (
    collateralAmount: string,
    borrowAmount: string
  ) => {
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
  };

  return (
    <>
      <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <ColHeader icon={Hash} label="ID" />
              <ColHeader icon={Layers} label="Pool" />
              <ColHeader
                icon={TrendingDown}
                label="Borrow APR"
                tooltip="Annual interest rate you pay when borrowing"
              />
              <ColHeader
                icon={Shield}
                label="Collateral"
                tooltip="Maximum percentage of collateral value you can borrow"
              />
              <ColHeader
                icon={Droplets}
                label="Liquidity"
                tooltip="Total liquidity in pool"
              />
              <ColHeader icon={Zap} label="Actions" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  Loading borrow pools…
                </td>
              </tr>
            ) : poolsError ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-red-400 text-sm"
                >
                  Error loading borrow pools: {String(poolsError)}
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  No active borrow pools available
                </td>
              </tr>
            ) : (
              paginatedAssets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-white/5 hover:bg-white/2 transition-colors"
                >
                  <td className="px-4 py-4">
                    <IdBadge id={asset.id} isActive={asset.isActive} />
                  </td>
                  <td className="px-4 py-4">
                    <PoolCell
                      token1={asset.pool.token1}
                      token2={asset.pool.token2}
                      fee={asset.pool.fee}
                    />
                  </td>
                  <td className="px-4 py-4 text-white text-sm">
                    {asset.borrowApr}
                  </td>
                  <td className="px-4 py-4 text-white text-sm">
                    {asset.collateralFactorDisplay}
                  </td>
                  <td className="px-4 py-4 text-white text-sm">
                    {asset.liquidity}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => handleBorrowClick(asset)}
                      className="rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] px-4 py-1.5 text-white text-xs font-semibold transition-colors"
                    >
                      Borrow
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalRows > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <span>Rows per page</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setPage(0);
                }}
                className="bg-[#2A2A2A] border border-white/10 rounded-lg px-2 py-1 text-white/60 text-xs outline-none cursor-pointer"
              >
                {ROWS_PER_PAGE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span>
                {page * rowsPerPage} -{" "}
                {Math.min((page + 1) * rowsPerPage, totalRows)} of {totalRows}{" "}
                rows
              </span>
            </div>

            <div className="flex items-center gap-1">
              <PageBtn onClick={() => setPage(0)} disabled={page === 0}>
                <ChevronFirst className="h-3.5 w-3.5" />
              </PageBtn>
              <PageBtn
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </PageBtn>
              {Array.from({ length: totalPages }, (_, i) => i)
                .filter(
                  (i) =>
                    i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 1
                )
                .reduce<(number | "…")[]>((acc, i, idx, arr) => {
                  if (idx > 0 && (i as number) - (arr[idx - 1] as number) > 1)
                    acc.push("…");
                  acc.push(i);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "…" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-white/30 text-xs"
                    >
                      …
                    </span>
                  ) : (
                    <PageBtn
                      key={item}
                      onClick={() => setPage(item as number)}
                      active={page === item}
                    >
                      {(item as number) + 1}
                    </PageBtn>
                  )
                )}
              <PageBtn
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </PageBtn>
              <PageBtn
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
              >
                <ChevronLast className="h-3.5 w-3.5" />
              </PageBtn>
            </div>
          </div>
        )}
      </div>

      {selectedAsset && (
        <BorrowModal
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={handleCloseModal}
          isProcessing={isProcessing}
          error={executionError}
          success={success}
          onClearError={clearError}
          onClearSuccess={() => setSuccess(null)}
          onSubmit={handleSubmit}
          isWalletConnected={!!isWalletConnected}
        />
      )}
    </>
  );
};

function PageBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`h-7 min-w-7 rounded-lg px-1.5 text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        active
          ? "bg-[#229EDF] text-white"
          : "text-white/50 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default BorrowTable;
