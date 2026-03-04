"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { calculateBorrowLimit } from "../../utils/borrowUtils";
import type { BorrowTableAsset } from "../../types/borrowing";

interface BorrowModalProps {
  asset: BorrowTableAsset;
  isProcessing: boolean;
  error: string | null;
  success: string | null;
  isWalletConnected: boolean;
  onClose: () => void;
  onSubmit: (collateral: string, borrow: string) => Promise<void>;
  onClearError: () => void;
  onClearSuccess: () => void;
}

export function BorrowModal({
  asset,
  isProcessing,
  error,
  success,
  isWalletConnected,
  onClose,
  onSubmit,
  onClearError,
  onClearSuccess,
}: BorrowModalProps) {
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");

  const borrowLimit = useMemo(
    () =>
      collateralAmount
        ? calculateBorrowLimit(
            parseFloat(collateralAmount),
            asset.collateralFactor
          )
        : 0,
    [collateralAmount, asset.collateralFactor]
  );

  const borrowLimitExceeded =
    borrowAmount !== "" && parseFloat(borrowAmount) > borrowLimit;
  const canSubmit =
    isWalletConnected &&
    parseFloat(collateralAmount) > 0 &&
    parseFloat(borrowAmount) > 0 &&
    !borrowLimitExceeded;

  const handleSubmit = async () => {
    await onSubmit(collateralAmount, borrowAmount);
    setCollateralAmount("");
    setBorrowAmount("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
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

        <div className="mb-4 rounded-2xl bg-white/5 p-4">
          <p className="text-white/40 text-xs mb-1">Collateral Token</p>
          <p className="text-white font-semibold text-lg">
            {asset.collateralTokenCode}
          </p>
          <p className="text-white/30 text-xs mt-0.5">
            Collateral Factor: {asset.collateralFactor}%
          </p>
        </div>

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

        <div className="mb-4 rounded-2xl bg-[#229EDF]/10 border border-[#229EDF]/20 p-4">
          <p className="text-[#229EDF]/70 text-xs">Your Borrow Limit</p>
          <p className="text-[#229EDF] font-bold text-2xl">
            {borrowLimit.toFixed(2)} {asset.assetCode}
          </p>
        </div>

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

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 rounded-xl border border-white/10 py-3 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
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
