"use client";

import React from "react";
import Image from "next/image";
import type { VaultView, VaultCategory } from "../../types/vault";
import { VaultAssetIllustrations } from "./VaultAssetIllustrations";

interface VaultCardProps {
  vault: VaultView;
  isLoading?: boolean;
  onDetailsClick?: (vault: VaultView) => void;
  onDepositClick?: () => void;
}

const CATEGORY_LABEL: Record<VaultCategory, string> = {
  lending: "Lending",
  rwa: "RWA",
  amm: "AMM",
  staking: "Staking",
};

export const VaultCard: React.FC<VaultCardProps> = ({
  vault,
  isLoading,
  onDetailsClick,
  onDepositClick,
}) => {
  const isLight = (vault.variant ?? "light") === "light";
  const categoryLabel = CATEGORY_LABEL[vault.category];

  return (
    <div
      className="group isolate flex flex-col rounded-2xl overflow-hidden border transition-all duration-300 hover:scale-[1.01] hover:shadow-2xl cursor-pointer"
      style={{
        borderColor: "rgba(255,255,255,0.05)",
        boxShadow: isLight
          ? "0 2px 16px 0 rgba(0,0,0,0.08)"
          : "0 2px 16px 0 rgba(0,0,0,0.4)",
      }}
    >
      {/* ── TOP SECTION ─────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: isLight ? "#FFFFFF" : "#242424",
          minHeight: 124,
        }}
      >
        {!isLight && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 85% 50%, rgba(34,158,223,0.08) 0%, transparent 70%)",
            }}
          />
        )}

        {/* icon + name + badge */}
        <div className="relative z-10 flex items-center gap-3 px-5 py-4 pr-[46%]">
          <div className="w-12 h-12 rounded-full bg-[#111] flex items-center justify-center shrink-0 overflow-hidden shadow-md">
            <Image
              src={vault.supplyAsset.iconSrc}
              alt={vault.supplyAsset.symbol}
              width={28}
              height={28}
              unoptimized
            />
          </div>

          <div className="min-w-0">
            <h3
              className="font-bold text-base leading-tight"
              style={{ color: isLight ? "#111111" : "#FFFFFF" }}
            >
              {vault.name}
            </h3>
            <span
              className="inline-block mt-1.5 px-3 py-0.5 rounded-full text-xs font-semibold"
              style={
                isLight
                  ? {
                      border: "1px solid rgba(0,0,0,0.18)",
                      color: "#333",
                      background: "transparent",
                    }
                  : {
                      border: "1px solid rgba(34,158,223,0.45)",
                      color: "#229EDF",
                      background: "rgba(34,158,223,0.1)",
                    }
              }
            >
              {categoryLabel}
            </span>
          </div>
        </div>

        <VaultAssetIllustrations
          collateralAssets={vault.collateralAssets}
          isLight={isLight}
        />
      </div>

      {/* ── BOTTOM SECTION ──────────────────────────────── */}
      <div
        className="flex items-stretch px-5 py-3"
        style={{ background: isLight ? "#141414" : "#181818" }}
        onClick={() => onDetailsClick?.(vault)}
      >
        {/* Supply + Created by */}
        <div className="flex flex-col justify-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-xs">Supply</span>
            <div className="w-4 h-4 rounded-full overflow-hidden shrink-0">
              <Image
                src={vault.supplyAsset.logoSrc}
                alt={vault.supplyAsset.symbol}
                width={16}
                height={16}
                unoptimized
              />
            </div>
            <span className="text-white/80 text-xs font-medium">
              {vault.supplyAsset.symbol}
            </span>
            <span className="text-white/40 text-xs">on</span>
            <div className="w-4 h-4 rounded-full overflow-hidden shrink-0">
              <Image
                src="/assets/xlm-logo.png"
                alt="Stellar"
                width={16}
                height={16}
                unoptimized
              />
            </div>
            <span className="text-white/80 text-xs font-medium">
              {vault.supplyAsset.network}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-xs">Created by</span>
            {vault.creatorIconSrc && (
              <div className="w-4 h-4 rounded-full overflow-hidden shrink-0">
                <Image
                  src={vault.creatorIconSrc}
                  alt={vault.createdBy}
                  width={16}
                  height={16}
                  unoptimized
                />
              </div>
            )}
            <span className="text-white/80 text-xs font-medium">
              {vault.createdBy}
            </span>
          </div>
        </div>

        <div className="w-px bg-white/8 mx-4 shrink-0" />

        {/* TVL */}
        <div className="flex flex-col justify-center gap-0.5 shrink-0">
          <span className="text-white/40 text-[10px] font-medium uppercase tracking-wide">
            TVL
          </span>
          {isLoading ? (
            <div className="h-5 w-16 rounded bg-white/10 animate-pulse" />
          ) : (
            <span className="text-white text-base font-bold">{vault.tvl}</span>
          )}
        </div>

        <div className="w-px bg-white/8 mx-4 shrink-0" />

        {/* APY */}
        <div className="flex flex-col justify-center gap-0.5 shrink-0">
          <span className="text-white/40 text-[10px] font-medium uppercase tracking-wide">
            APY (7d)
          </span>
          {isLoading ? (
            <div className="h-5 w-14 rounded bg-white/10 animate-pulse" />
          ) : (
            <span className="text-[#4ADE80] text-base font-bold">
              {vault.apy7d}
            </span>
          )}
        </div>
      </div>

      {/* ── ACTIONS ─────────────────────────────────────── */}
      <div
        className="flex gap-2 px-4 py-3"
        style={{ background: isLight ? "#141414" : "#181818" }}
      >
        <button
          aria-label={`View details for ${vault.name}`}
          onClick={() => onDetailsClick?.(vault)}
          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border border-white/15 hover:border-white/35 text-white/60 hover:text-white bg-transparent"
        >
          Details
        </button>
        <button
          aria-label={`Deposit into ${vault.name}`}
          onClick={onDepositClick}
          className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200 border border-[#229EDF]/50 hover:border-[#229EDF] text-[#229EDF] hover:text-white hover:bg-[#229EDF]/10 bg-transparent"
        >
          Deposit
        </button>
      </div>
    </div>
  );
};
