"use client";

import React from "react";
import type { PoolCardData } from "@/features/pools/types/pools";

interface PoolCardProps {
  pool: PoolCardData;
  onDetailsClick: () => void;
  onLendClick?: () => void;
  onSwapClick?: () => void;
}

function typeLabel(type: string): string {
  if (type === "blend" || type === "neko") return "Lending";
  if (type === "soroswap") return "AMM";
  return type;
}

export const PoolCard: React.FC<PoolCardProps> = ({
  pool,
  onDetailsClick,
  onLendClick,
  onSwapClick,
}) => (
  <div className="rounded-2xl bg-[#1C1C1C] p-6 border border-white/5 hover:border-[#229EDF]/50 transition-all duration-300 hover:shadow-xl relative overflow-hidden group">
    {/* Header with Pool Info */}
    <div className="relative z-10 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-8">
            <div className="absolute left-0 w-8 h-8 rounded-full bg-[#229EDF] border-2 border-white/10 flex items-center justify-center text-white text-sm font-bold shadow-md">
              {pool.token1[0]}
            </div>
            <div className="absolute left-6 w-8 h-8 rounded-full bg-[#229EDF]/60 border-2 border-white/10 flex items-center justify-center text-white text-sm font-bold shadow-md">
              {pool.token2[0]}
            </div>
          </div>
          <div>
            <h3 className="text-white text-xl font-bold">
              {pool.token1} / {pool.token2}
            </h3>
            <div className="inline-block bg-white/10 text-white text-xs font-semibold px-2 py-1 rounded-md mt-1">
              {typeLabel(pool.type)}
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              pool.isActive ? "bg-[#229EDF]" : "bg-gray-400"
            } animate-pulse`}
          />
        </div>
      </div>
    </div>

    {/* Stats Grid */}
    <div className="relative z-10 space-y-4 mb-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#2A2A2A] rounded-xl p-3 border border-white/10">
          <p className="text-white/40 text-xs mb-1">ROI</p>
          <p className="text-white text-lg font-bold">{pool.roi}</p>
        </div>
        <div className="bg-[#2A2A2A] rounded-xl p-3 border border-white/10">
          <p className="text-white/40 text-xs mb-1">Fee APY</p>
          <p className="text-white text-lg font-bold">{pool.feeApy}</p>
        </div>
        <div className="bg-[#2A2A2A] rounded-xl p-3 border border-white/10">
          <p className="text-white/40 text-xs mb-1">Liquidity</p>
          <p className="text-white text-lg font-bold">{pool.liquidity}</p>
        </div>
      </div>
    </div>

    {/* Pool Details CTA */}
    <div
      className="relative z-10 bg-[#2A2A2A] rounded-xl p-4 mb-4 border border-white/10 hover:bg-[#333] cursor-pointer transition-colors duration-200"
      onClick={onDetailsClick}
    >
      <div className="flex items-center justify-center">
        <button className="text-white/70 px-3 py-1 rounded-lg text-sm font-semibold duration-200 flex items-center gap-1">
          Pool Details <span className="opacity-70">&rarr;</span>
        </button>
      </div>
    </div>

    {/* Action Buttons */}
    {onLendClick != null && (
      <div className="relative z-10 flex">
        <button
          className="flex-1 bg-[#229EDF] hover:bg-[#1a8bc7] text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-200"
          onClick={onLendClick}
        >
          Lend
        </button>
      </div>
    )}

    {onSwapClick != null && (
      <div className="relative z-10 flex">
        <button
          className="flex-1 bg-[#229EDF] hover:bg-[#1a8bc7] text-white px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-200"
          onClick={onSwapClick}
        >
          Swap
        </button>
      </div>
    )}
  </div>
);
