"use client";

import React from "react";
import Image from "next/image";
import {
  TrendingUp,
  Droplets,
  Percent,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import type { PoolCardData } from "@/features/pools/types/pools";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";

interface PoolCardProps {
  pool: PoolCardData;
  onDetailsClick: () => void;
  onLendClick?: () => void;
  onSwapClick?: () => void;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  blend: { label: "Lending", color: "#229EDF", bg: "rgba(34,158,223,0.1)" },
  neko: { label: "Lending", color: "#229EDF", bg: "rgba(34,158,223,0.1)" },
  soroswap: { label: "AMM", color: "#A78BFA", bg: "rgba(167,139,250,0.1)" },
};

export const PoolCard: React.FC<PoolCardProps> = ({
  pool,
  onDetailsClick,
  onLendClick,
  onSwapClick,
}) => {
  const typeConfig = TYPE_CONFIG[pool.type] || {
    label: pool.type,
    color: "#888",
    bg: "rgba(136,136,136,0.1)",
  };

  const icon1 = getTokenIcon({ type: "contract", code: pool.token1 });
  const icon2 = getTokenIcon({ type: "contract", code: pool.token2 });

  return (
    <div className="group relative flex flex-col rounded-2xl bg-[#1A1A1A] border border-white/5 overflow-hidden transition-all duration-300 hover:border-[#229EDF]/30 hover:shadow-xl hover:shadow-[#229EDF]/5">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#229EDF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Token pair icons */}
            <div className="relative w-14 h-10 shrink-0">
              <div className="absolute left-0 w-10 h-10 rounded-xl bg-[#242424] border border-white/10 flex items-center justify-center overflow-hidden">
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
              <div className="absolute left-6 w-10 h-10 rounded-xl bg-[#242424] border border-white/10 flex items-center justify-center overflow-hidden">
                {icon2 ? (
                  <Image
                    src={icon2}
                    alt={pool.token2}
                    width={24}
                    height={24}
                    unoptimized
                  />
                ) : (
                  <span className="text-white text-sm font-bold">
                    {pool.token2[0]}
                  </span>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-white font-bold text-lg leading-tight mb-1">
                {pool.token1} / {pool.token2}
              </h3>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  color: typeConfig.color,
                  backgroundColor: typeConfig.bg,
                }}
              >
                {typeConfig.label}
              </span>
            </div>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                pool.isActive ? "bg-[#4ADE80]" : "bg-gray-400"
              }`}
            />
            <span
              className={`text-xs font-medium ${
                pool.isActive ? "text-[#4ADE80]" : "text-gray-400"
              }`}
            >
              {pool.isActive ? "Active" : "Paused"}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-[#242424] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="h-3 w-3 text-[#4ADE80]" />
              <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                Supply APY
              </span>
            </div>
            <p className="text-[#4ADE80] text-xl font-bold">{pool.roi}</p>
          </div>

          <div className="bg-[#242424] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <Percent className="h-3 w-3 text-[#229EDF]" />
              <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                Fee APY
              </span>
            </div>
            <p className="text-white text-xl font-bold">{pool.feeApy}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#242424] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <Droplets className="h-3 w-3 text-[#229EDF]" />
              <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                Liquidity
              </span>
            </div>
            <p className="text-white text-lg font-bold">{pool.liquidity}</p>
          </div>

          <div className="bg-[#242424] rounded-xl p-3 border border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <ShieldCheck className="h-3 w-3 text-[#4ADE80]" />
              <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
                Risk
              </span>
            </div>
            <p className="text-[#4ADE80] text-lg font-bold">Low</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-10 flex gap-2 p-4 pt-0">
        <button
          onClick={onDetailsClick}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5"
        >
          Details
        </button>
        {onLendClick && (
          <button
            onClick={onLendClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-[#229EDF] hover:bg-[#1a8bc7] text-white"
          >
            Lend
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
        {onSwapClick && (
          <button
            onClick={onSwapClick}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-[#229EDF] hover:bg-[#1a8bc7] text-white"
          >
            Swap
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
