"use client";

import { useState } from "react";
import { X, AlertTriangle } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { BorrowPosition } from "../../hooks/useUserBorrowPositions";

interface RemoveCollateralModalProps {
  position: BorrowPosition;
  isProcessing: boolean;
  isWalletConnected: boolean;
  onClose: () => void;
  onSubmit: (amount: string) => Promise<void>;
}

export function RemoveCollateralModal({
  position,
  isProcessing,
  isWalletConnected,
  onClose,
  onSubmit,
}: RemoveCollateralModalProps) {
  const [amount, setAmount] = useState("");

  const amountNum = parseFloat(amount);
  const isValidAmount =
    Number.isFinite(amountNum) &&
    amountNum > 0 &&
    amountNum <= parseFloat(position.collateralFormatted);
  const exceedsCollateral =
    Number.isFinite(amountNum) &&
    amountNum > parseFloat(position.collateralFormatted);

  const canSubmit = isWalletConnected && isValidAmount && !isProcessing;

  const handleMax = () => {
    setAmount(position.collateralFormatted);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(amount);
    setAmount("");
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate__animated animate__fadeIn animate__faster">
        <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-4 sm:p-5 animate__animated animate__fadeInUp animate__faster">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-lg font-bold">
              Remove {position.collateralTokenCode} Collateral
            </h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors -mr-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Collateral info */}
          <div className="mb-3 rounded-xl bg-white/5 border border-white/10 p-3">
            <p className="text-white/40 text-xs">Current Collateral</p>
            <p className="text-white font-bold text-sm tabular-nums">
              {position.collateralFormatted}{" "}
              <span className="text-white/40 font-normal text-xs">
                {position.collateralTokenCode}
              </span>
            </p>
          </div>

          {/* Health factor warning */}
          <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-amber-400/90 text-xs leading-relaxed">
              Removing too much collateral may lower your health factor and
              increase liquidation risk. The contract will reject the
              transaction if it would drop below the minimum.
            </p>
          </div>

          {/* Amount input */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-white/60 text-xs font-medium">
                Amount to Remove ({position.collateralTokenCode})
              </label>
              <button
                onClick={handleMax}
                disabled={isProcessing}
                className="text-[#229EDF] text-xs font-semibold hover:text-[#229EDF]/80 transition-colors disabled:opacity-50"
              >
                MAX
              </button>
            </div>
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-[#2A2A2A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
            />
            {exceedsCollateral && (
              <p className="text-red-400 text-xs mt-1">
                Exceeds your collateral balance
              </p>
            )}
          </div>

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
              disabled={!canSubmit}
              className="flex-1 rounded-xl bg-[#229EDF] py-2.5 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? "Processing…"
                : !isWalletConnected
                  ? "Connect Wallet"
                  : "Remove Collateral"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
