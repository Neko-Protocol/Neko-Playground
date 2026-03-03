"use client";

import React from "react";
import type { PoolCardData } from "@/features/pools/types/pools";
import { getPoolTypeLabel } from "@/features/pools/types/pools";

interface PoolCardProps {
  pool: PoolCardData;
  onDetailsClick: () => void;
  onLendClick?: () => void;
  onBorrowClick?: () => void;
  onAddLiquidityClick?: () => void;
}

export const PoolCard: React.FC<PoolCardProps> = ({
  pool,
  onDetailsClick,
  onLendClick,
  onBorrowClick,
  onAddLiquidityClick,
}) => {
  const actionButtons = [
    onLendClick && { label: "Lend", onClick: onLendClick },
    onBorrowClick && { label: "Borrow", onClick: onBorrowClick },
    onAddLiquidityClick && {
      label: "Add Liquidity",
      onClick: onAddLiquidityClick,
    },
  ].filter(Boolean) as { label: string; onClick: () => void }[];

  return (
    <div className="rounded-3xl bg-neko-accent p-6 shadow-lg border border-neko-border/50 hover:border-neko-teal transition-all duration-300 hover:shadow-xl relative overflow-hidden group">
      {/* Background decoration */}
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-neko-border/20 rounded-full blur-2xl pointer-events-none" />

      {/* Header with Pool Info */}
      <div className="relative z-10 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-8">
              <div className="absolute left-0 w-8 h-8 rounded-full bg-neko-teal border-2 border-neko-border flex items-center justify-center text-white text-sm font-bold shadow-md">
                {pool.token1[0]}
              </div>
              <div className="absolute left-6 w-8 h-8 rounded-full bg-neko-teal-light border-2 border-neko-border flex items-center justify-center text-neko-navy text-sm font-bold shadow-md">
                {pool.token2[0]}
              </div>
            </div>
            <div>
              <h3 className="text-white text-xl font-bold">
                {pool.token1} / {pool.token2}
              </h3>
              <div className="inline-block bg-white/10 text-white text-xs font-semibold px-2 py-1 rounded-md mt-1">
                {getPoolTypeLabel(pool.type)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="relative z-10 space-y-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-neko-accent rounded-xl p-3 border border-white/10">
            <p className="text-neko-muted text-xs mb-1">ROI</p>
            <p className="text-white text-lg font-bold">{pool.roi}</p>
          </div>
          <div className="bg-neko-accent rounded-xl p-3 border border-white/10">
            <p className="text-neko-muted text-xs mb-1">Fee APY</p>
            <p className="text-white text-lg font-bold">{pool.feeApy}</p>
          </div>
          <div className="bg-neko-accent rounded-xl p-3 border border-white/10">
            <p className="text-neko-muted text-xs mb-1">Liquidity</p>
            <p className="text-white text-lg font-bold">{pool.liquidity}</p>
          </div>
        </div>
      </div>

      {/* Pool Details - restyled as outlined */}
      <div
        className="relative z-10 rounded-2xl p-4 mb-4 border border-white/20 hover:bg-white/5 cursor-pointer transition-colors duration-200"
        onClick={onDetailsClick}
      >
        <div className="flex items-center justify-center">
          <button className="text-white px-3 py-1 rounded-lg text-sm font-semibold duration-200 flex items-center gap-1">
            Pool Details <span className="opacity-70">&rarr;</span>
          </button>
        </div>
      </div>

      {/* Action Buttons: Lend, Borrow, Add Liquidity */}
      {actionButtons.length > 0 && (
        <div className="relative z-10 flex flex-wrap gap-2">
          {actionButtons.map(({ label, onClick }) => (
            <button
              key={label}
              className="flex-1 min-w-0 bg-neko-navy hover:bg-neko-navy-hover text-neko-cream px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-200 border border-neko-border/30"
              onClick={onClick}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Status Indicator */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            pool.isActive ? "bg-neko-teal" : "bg-gray-400"
          } animate-pulse`}
        />
      </div>
    </div>
  );
};
