"use client";

import { X, Coins, TrendingDown, Activity } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { BorrowPosition } from "../../hooks/useUserBorrowPositions";

const SCALAR_12 = 1_000_000_000_000n;

function formatDRate(dRate: bigint): string {
  if (dRate === 0n) return "—";
  const whole = dRate / SCALAR_12;
  const frac = dRate % SCALAR_12;
  const fracStr = frac.toString().padStart(12, "0").slice(0, 6);
  return `${whole}.${fracStr}`;
}

interface ViewPositionModalProps {
  position: BorrowPosition;
  onClose: () => void;
}

export function ViewPositionModal({
  position,
  onClose,
}: ViewPositionModalProps) {
  return (
    <ModalPortal>
      <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate__animated animate__fadeIn animate__faster">
        <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 animate__animated animate__fadeInUp animate__faster">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-yellow-400/15 flex items-center justify-center">
                <Coins className="h-4 w-4 text-yellow-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-base leading-none">
                  {position.assetCode} Position
                </h3>
                <p className="text-white/40 text-xs mt-0.5">
                  Collateral: {position.collateralTokenCode}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors -mr-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Current Debt — hero stat */}
          <div className="rounded-xl bg-yellow-400/10 border border-yellow-400/20 p-4 mb-4">
            <p className="text-yellow-400/70 text-xs mb-1.5">Current Debt</p>
            <p className="text-white font-bold text-3xl leading-none">
              {position.debtFormatted}
              <span className="text-white/40 text-base font-normal ml-2">
                {position.assetCode}
              </span>
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl bg-[#242424] px-3 py-3">
              <div className="flex items-center gap-1 text-white/40 mb-1.5">
                <TrendingDown className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  Borrow APR
                </span>
              </div>
              <p className="text-white text-sm font-semibold">
                {position.interestRate.toFixed(2)}%
              </p>
            </div>

            <div className="rounded-xl bg-[#242424] px-3 py-3">
              <div className="flex items-center gap-1 text-white/40 mb-1.5">
                <Activity className="h-3 w-3" />
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  dToken Rate
                </span>
              </div>
              <p className="text-white text-sm font-semibold font-mono">
                {formatDRate(position.dRate)}
              </p>
            </div>
          </div>

          {/* dToken balance footer */}
          <div className="rounded-xl bg-[#242424] px-3 py-3 flex items-center justify-between">
            <p className="text-white/40 text-xs">dToken Balance</p>
            <p className="text-white/70 text-xs font-mono">
              {position.dTokens.toLocaleString()}
            </p>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full rounded-xl border border-white/10 py-2.5 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}
