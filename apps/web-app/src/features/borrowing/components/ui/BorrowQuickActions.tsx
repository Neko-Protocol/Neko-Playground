"use client";

import React from "react";
import { ChevronDown, Shield, RotateCcw } from "lucide-react";
import type { BorrowPosition } from "../../hooks/useUserBorrowPositions";

interface BorrowQuickActionsProps {
  positions: BorrowPosition[];
  selectedPosition: BorrowPosition | null;
  onSelectPosition: (position: BorrowPosition | null) => void;
  onRemoveClick: () => void;
  onRepayClick: () => void;
}

export function BorrowQuickActions({
  positions,
  selectedPosition,
  onSelectPosition,
  onRemoveClick,
  onRepayClick,
}: BorrowQuickActionsProps) {
  if (positions.length === 0) return null;

  const hasSelection = selectedPosition !== null;

  return (
    <div className="w-full rounded-2xl border border-white/5 bg-[#1C1C1C] p-4 mb-6">
      <div className="flex items-center px-1 py-2 mb-3">
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          Quick Actions
        </span>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        {/* Loan selector */}
        <div className="flex-1 min-w-0">
          <label className="block text-white/40 text-xs font-medium mb-1.5">
            Select loan
          </label>
          <div className="relative">
            <select
              value={
                selectedPosition
                  ? `${selectedPosition.assetCode}-${selectedPosition.collateralTokenCode}`
                  : ""
              }
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onSelectPosition(null);
                  return;
                }
                const pos = positions.find(
                  (p) => `${p.assetCode}-${p.collateralTokenCode}` === val
                );
                onSelectPosition(pos ?? null);
              }}
              className="w-full appearance-none rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 pr-10 text-sm text-white focus:border-[#229EDF]/50 outline-none transition-colors"
            >
              <option value="">Choose a position…</option>
              {positions.map((pos) => (
                <option
                  key={`${pos.assetCode}-${pos.collateralTokenCode}`}
                  value={`${pos.assetCode}-${pos.collateralTokenCode}`}
                >
                  {pos.assetCode} / {pos.collateralTokenCode} collateral
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 sm:items-end">
          <button
            onClick={onRemoveClick}
            disabled={!hasSelection}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:text-white/80"
          >
            <Shield className="h-4 w-4" />
            Remove Asset
          </button>
          <button
            onClick={onRepayClick}
            disabled={!hasSelection}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="h-4 w-4" />
            Repay Loans
          </button>
        </div>
      </div>
    </div>
  );
}
