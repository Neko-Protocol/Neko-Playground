"use client";

import React from "react";
import Image from "next/image";
import type { PoolCardData } from "@/features/pools/types/pools";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";

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
  <div className="rounded-2xl bg-[#1C1C1C] p-4 sm:p-6 border border-white/5 hover:border-[#229EDF]/50 transition-all duration-300 hover:shadow-xl relative overflow-hidden group">
    {}
    <div className="relative z-10 mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative w-14 h-8 shrink-0">
            {(() => {
              const icon1 = getTokenIcon({
                type: "contract",
                code: pool.token1,
              });
              const icon2 = getTokenIcon({
                type: "contract",
                code: pool.token2,
              });
              return (
                <>
                  <div className="absolute left-0 w-8 h-8 rounded-full bg-neko-teal border-2 border-neko-border flex items-center justify-center overflow-hidden shadow-md">
                    {icon1 ? (
                      <Image
                        src={icon1}
                        alt={pool.token1}
                        width={24}
                        height={24}
                        unoptimized
                      />
                    ) : (
                      <span className="text-white text-sm font-bold">
                        {pool.token1[0]}
                      </span>
                    )}
                  </div>
                  <div className="absolute left-6 w-8 h-8 rounded-full bg-neko-teal-light border-2 border-neko-border flex items-center justify-center overflow-hidden shadow-md">
                    {icon2 ? (
                      <Image
                        src={icon2}
                        alt={pool.token2}
                        width={24}
                        height={24}
                        unoptimized
                      />
                    ) : (
                      <span className="text-neko-navy text-sm font-bold">
                        {pool.token2[0]}
                      </span>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          <div className="min-w-0">
            <h3 className="text-white text-base sm:text-xl font-bold wrap-break-word">
              {pool.token1} / {pool.token2}
            </h3>
            <div className="inline-block bg-white/10 text-white text-xs font-semibold px-2 py-1 rounded-md mt-1">
              {typeLabel(pool.type)}
            </div>
          </div>
        </div>

        {}
        <div className="flex items-center gap-2">
          {pool.state === "active" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#229EDF]/10 border border-[#229EDF]/20">
              <div className="w-1.5 h-1.5 rounded-full bg-[#229EDF] animate-pulse" />
              <span className="text-[#229EDF] text-[10px] font-bold uppercase tracking-wider">Active</span>
            </div>
          )}
          {pool.state === "on_ice" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="text-orange-500 text-[10px] font-bold uppercase tracking-wider">On Ice</span>
            </div>
          )}
          {pool.state === "frozen" && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
              <span className="text-red-500 text-[10px] font-bold uppercase tracking-wider">Frozen</span>
            </div>
          )}
        </div>
      </div>
    </div>

    {}
    <div className="relative z-10 space-y-3 sm:space-y-4 mb-4 sm:mb-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-[#2A2A2A] rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/10 min-w-0">
          <p className="text-white/40 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
            ROI
          </p>
          <p className="text-white text-base sm:text-lg font-bold wrap-break-word leading-tight">
            {pool.roi}
          </p>
        </div>
        <div className="bg-[#2A2A2A] rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/10 min-w-0">
          <p className="text-white/40 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
            Fee APY
          </p>
          <p className="text-white text-base sm:text-lg font-bold wrap-break-word leading-tight">
            {pool.feeApy}
          </p>
        </div>
        <div className="bg-[#2A2A2A] rounded-lg sm:rounded-xl p-2 sm:p-3 border border-white/10 min-w-0">
          <p className="text-white/40 text-[10px] sm:text-xs mb-0.5 sm:mb-1">
            Liquidity
          </p>
          <p className="text-white text-base sm:text-lg font-bold wrap-break-word leading-tight">
            {pool.liquidity}
          </p>
        </div>
      </div>
    </div>

    {}
    <div
      className="relative z-10 bg-[#2A2A2A] rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4 border border-white/10 hover:bg-[#333] cursor-pointer transition-colors duration-200"
      onClick={onDetailsClick}
    >
      <div className="flex items-center justify-center">
        <button className="text-white/70 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-semibold duration-200 flex items-center gap-1">
          Pool Details <span className="opacity-70">&rarr;</span>
        </button>
      </div>
    </div>

    {}
    {onLendClick != null && (
      <div className="relative z-10 flex">
        <button
          className="flex-1 bg-[#229EDF] hover:bg-[#1a8bc7] text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-colors duration-200"
          onClick={onLendClick}
        >
          Lend
        </button>
      </div>
    )}

    {onSwapClick != null && (
      <div className="relative z-10 flex">
        <button
          className="flex-1 bg-[#229EDF] hover:bg-[#1a8bc7] text-white px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold transition-colors duration-200"
          onClick={onSwapClick}
        >
          Swap
        </button>
      </div>
    )}
  </div>
);
