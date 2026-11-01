"use client";

import React from "react";
import Image from "next/image";
import { ShieldCheck, TrendingUp, Droplets, ArrowRight } from "lucide-react";
import type { VaultView, VaultCategory } from "../../types/vault";
import { VaultAssetIllustrations } from "./VaultAssetIllustrations";

interface VaultCardProps {
  vault: VaultView;
  isLoading?: boolean;
  onDetailsClick?: (vault: VaultView) => void;
  onDepositClick?: () => void;
}

const CATEGORY_CONFIG: Record<
  VaultCategory,
  { label: string; color: string; bg: string }
> = {
  lending: { label: "Lending", color: "#229EDF", bg: "rgba(34,158,223,0.1)" },
  rwa: { label: "RWA", color: "#4ADE80", bg: "rgba(74,222,128,0.1)" },
  amm: { label: "AMM", color: "#A78BFA", bg: "rgba(167,139,250,0.1)" },
  staking: { label: "Staking", color: "#FBBF24", bg: "rgba(251,191,36,0.1)" },
};

export const VaultCard: React.FC<VaultCardProps> = ({
  vault,
  isLoading,
  onDetailsClick,
  onDepositClick,
}) => {
  const categoryConfig = CATEGORY_CONFIG[vault.category];

  return (
    <div className="group relative flex flex-col rounded-2xl bg-[#1A1A1A] border border-white/5 overflow-hidden transition-all duration-300 hover:border-[#229EDF]/30 hover:shadow-xl hover:shadow-[#229EDF]/5">
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#229EDF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 p-5 pb-0">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 rounded-xl bg-[#242424] flex items-center justify-center overflow-hidden border border-white/5">
              <Image
                src={vault.supplyAsset.iconSrc}
                alt={vault.supplyAsset.symbol}
                width={28}
                height={28}
                unoptimized
              />
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight mb-1">
                {vault.name}
              </h3>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  color: categoryConfig.color,
                  backgroundColor: categoryConfig.bg,
                }}
              >
                {categoryConfig.label}
              </span>
            </div>
          </div>

          {vault.featured && (
            <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-[#4ADE80]/10 text-[#4ADE80]">
              Featured
            </span>
          )}
        </div>

        {/* Collateral assets preview */}
        <VaultAssetIllustrations
          collateralAssets={vault.collateralAssets}
          isLight={false}
        />
      </div>

      {/* Metrics Grid */}
      <div className="relative z-10 grid grid-cols-3 gap-3 p-5 pt-4">
        <div className="bg-[#242424] rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="h-3 w-3 text-[#4ADE80]" />
            <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              APY
            </span>
          </div>
          {isLoading ? (
            <div className="h-5 w-12 rounded bg-white/10 animate-pulse" />
          ) : (
            <p className="text-[#4ADE80] text-lg font-bold">{vault.apy7d}</p>
          )}
        </div>

        <div className="bg-[#242424] rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <Droplets className="h-3 w-3 text-[#229EDF]" />
            <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              TVL
            </span>
          </div>
          {isLoading ? (
            <div className="h-5 w-14 rounded bg-white/10 animate-pulse" />
          ) : (
            <p className="text-white text-lg font-bold">{vault.tvl}</p>
          )}
        </div>

        <div className="bg-[#242424] rounded-xl p-3 border border-white/5">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldCheck className="h-3 w-3 text-[#4ADE80]" />
            <span className="text-white/40 text-[10px] font-medium uppercase tracking-wider">
              Risk
            </span>
          </div>
          <p className="text-[#4ADE80] text-sm font-bold">Low</p>
        </div>
      </div>

      {/* Supply Info */}
      <div className="relative z-10 px-5 pb-4">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span>Supply</span>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5">
            <Image
              src={vault.supplyAsset.logoSrc}
              alt={vault.supplyAsset.symbol}
              width={14}
              height={14}
              className="rounded-full"
              unoptimized
            />
            <span className="text-white/70 font-medium">
              {vault.supplyAsset.symbol}
            </span>
          </div>
          <span>on</span>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5">
            <Image
              src="/assets/xlm-logo.png"
              alt="Stellar"
              width={14}
              height={14}
              className="rounded-full"
              unoptimized
            />
            <span className="text-white/70 font-medium">Stellar</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-10 flex gap-2 p-4 pt-0">
        <button
          onClick={() => onDetailsClick?.(vault)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5"
        >
          Details
        </button>
        <button
          onClick={onDepositClick}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 bg-[#229EDF] hover:bg-[#1a8bc7] text-white"
        >
          Deposit
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
