"use client";

import { useState, useMemo } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { calculateBorrowLimit } from "../../utils/borrowUtils";
import { usePositionSimulation } from "../../hooks/usePositionSimulation";
import { PositionPreviewPanel } from "./PositionPreviewPanel";
import type { BorrowTableAsset } from "../../types/borrowing";

interface BorrowModalProps {
  asset: BorrowTableAsset;
  isProcessing: boolean;
  isWalletConnected: boolean;
  onClose: () => void;
  onSubmit: (collateral: string, borrow: string) => Promise<void>;
}

export function BorrowModal({
  asset,
  isProcessing,
  isWalletConnected,
  onClose,
  onSubmit,
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

  // ─── Position simulation ─────────────────────────────────────────────
  const collateralNum = parseFloat(collateralAmount) || 0;
  const borrowNum = parseFloat(borrowAmount) || 0;

  const simulation = usePositionSimulation({
    collateralFactorPct: asset.collateralFactor,
    action: {
      type: "borrow",
      collateralAmount: collateralNum,
      borrowAmount: borrowNum,
    },
    enabled: isWalletConnected && (collateralNum > 0 || borrowNum > 0),
  });

  const canSubmit =
    isWalletConnected &&
    parseFloat(collateralAmount) > 0 &&
    parseFloat(borrowAmount) > 0 &&
    !borrowLimitExceeded &&
    simulation.canSubmit;

  const handleSubmit = async () => {
    await onSubmit(collateralAmount, borrowAmount);
    setCollateralAmount("");
    setBorrowAmount("");
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate__animated animate__fadeIn animate__faster">
        <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl p-4 sm:p-5 animate__animated animate__fadeInUp animate__faster">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-lg font-bold">
              Borrow {asset.assetCode}
            </h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors -mr-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-3 rounded-xl bg-white/5 p-3">
            <p className="text-white/40 text-xs mb-0.5">Collateral Token</p>
            <p className="text-white font-semibold text-base">
              {asset.collateralTokenCode}
            </p>
            <p className="text-white/30 text-xs mt-0.5">
              Collateral Factor: {asset.collateralFactor}%
            </p>
          </div>

          <div className="mb-3">
            <label className="text-white/60 text-xs font-medium block mb-1">
              Collateral Amount ({asset.collateralTokenCode})
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-[#2A2A2A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
            />
          </div>

          <div className="mb-3 rounded-xl bg-[#229EDF]/10 border border-[#229EDF]/20 p-3">
            <p className="text-[#229EDF]/70 text-xs">Your Borrow Limit</p>
            <p className="text-[#229EDF] font-bold text-lg">
              {borrowLimit.toFixed(2)} {asset.assetCode}
            </p>
          </div>

          <div className="mb-3">
            <label className="text-white/60 text-xs font-medium block mb-1">
              Borrow Amount ({asset.assetCode})
            </label>
            <input
              type="number"
              placeholder="0.00"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-[#2A2A2A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
            />
            {borrowLimitExceeded && (
              <p className="text-red-400 text-xs mt-1">
                Amount exceeds your borrow limit
              </p>
            )}
          </div>

          {/* Position Preview */}
          {isWalletConnected && (collateralNum > 0 || borrowNum > 0) && (
            <PositionPreviewPanel
              simulation={simulation}
              collateralTokenCode={asset.collateralTokenCode}
              debtTokenCode={asset.assetCode}
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={isProcessing || !canSubmit}
              className="flex-1 rounded-xl bg-[#229EDF] py-2.5 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
    </ModalPortal>
  );
}
