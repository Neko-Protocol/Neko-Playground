"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Globe,
  Building2,
} from "lucide-react";
import type { Asset } from "@neko/oracle";
import { useOracleAssetPrice } from "../../hooks/useOracleAssetPrice";
import { formatPrice, calculatePriceChange } from "../../utils/oracleUtils";
import { ROUTES, TIMESTAMP_MS_PER_SECOND } from "../../constants/oracle";
import { STOCK_INFO } from "../../utils/stockInfo";
import type { StockInfo } from "../../types/stocks";
import { useStockInfo } from "../../hooks/useStockInfo";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function formatPctChange(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(3)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(3)}K`;
  return `${value.toFixed(3)}`;
}

const ASSET_TYPE_MAP: Record<
  string,
  { label: string; icon: React.ElementType }
> = {
  USTRY: { label: "US Treasury", icon: Building2 },
  TESOURO: { label: "Brazil Treasury", icon: Building2 },
  CETES: { label: "Mexico Treasury", icon: Building2 },
  USDY: { label: "Yield Token", icon: TrendingUp },
  PYUSD: { label: "Stablecoin", icon: Globe },
  KTB: { label: "Korea Treasury", icon: Building2 },
};

export interface AssetPriceCardProps {
  asset: Asset;
  decimals?: number;
  stockInfo?: StockInfo | null;
}

export function AssetPriceCard({
  asset,
  decimals,
  stockInfo: stockInfoProp,
}: AssetPriceCardProps) {
  const { lastPrice, priceHistory, isLoadingPrice, assetStr } =
    useOracleAssetPrice(asset, { decimals });

  const fromOracle = useStockInfo(assetStr);
  const stockInfo =
    stockInfoProp ?? fromOracle ?? STOCK_INFO[assetStr.toUpperCase()];

  const priceChange = React.useMemo(() => {
    if (!lastPrice || !priceHistory || priceHistory.length < 2) return null;
    return calculatePriceChange(
      Number(lastPrice.price),
      Number(priceHistory[1].price)
    );
  }, [lastPrice, priceHistory]);

  const displayDecimals = decimals ?? 14;

  const assetType = ASSET_TYPE_MAP[assetStr.toUpperCase()] || {
    label: "RWA Token",
    icon: Globe,
  };
  const TypeIcon = assetType.icon;

  return (
    <Link href={ROUTES.stockDetail(assetStr)} className="block h-full group">
      <div className="relative rounded-2xl bg-[#1A1A1A] border border-white/5 overflow-hidden h-full flex flex-col transition-all duration-300 hover:border-[#229EDF]/30 hover:shadow-xl hover:shadow-[#229EDF]/5">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#229EDF]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative z-10 p-5 flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-xl bg-[#242424] overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
                {stockInfo?.logo ? (
                  <Image
                    src={stockInfo.logo}
                    alt={stockInfo.name}
                    fill
                    unoptimized
                    className="object-contain p-2"
                  />
                ) : (
                  <TypeIcon className="h-6 w-6 text-white/40" />
                )}
              </div>
              <div>
                <h3 className="text-white font-bold text-base leading-tight mb-1">
                  {stockInfo ? stockInfo.name : assetStr}
                </h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#229EDF]/10 text-[#229EDF]">
                    {assetStr}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/50">
                    <TypeIcon className="h-2.5 w-2.5" />
                    {assetType.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Price Section */}
          <div className="flex-1">
            {isLoadingPrice ? (
              <div className="flex items-center gap-2 py-4">
                <LoadingSpinner variant="dots" size="sm" />
                <span className="text-white/40 text-sm">Loading price…</span>
              </div>
            ) : lastPrice ? (
              <div className="bg-[#242424] rounded-xl p-4 border border-white/5">
                <div className="flex items-end justify-between mb-2">
                  <div>
                    <p className="text-white/40 text-[10px] font-medium uppercase tracking-wider mb-1">
                      Current Price
                    </p>
                    <p className="text-white text-3xl font-bold">
                      ${formatPrice(lastPrice.price, displayDecimals)}
                    </p>
                  </div>
                  {priceChange !== null && (
                    <div
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                        priceChange >= 0
                          ? "bg-[#4ADE80]/10 text-[#4ADE80]"
                          : "bg-[#EF4444]/10 text-[#EF4444]"
                      }`}
                    >
                      {priceChange >= 0 ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {formatPctChange(Math.abs(priceChange))}%
                    </div>
                  )}
                </div>
                <p className="text-white/30 text-xs">
                  Updated{" "}
                  {new Date(
                    Number(lastPrice.timestamp) * TIMESTAMP_MS_PER_SECOND
                  ).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="bg-[#242424] rounded-xl p-4 border border-white/5 text-center">
                <p className="text-white/30 text-sm">No price data available</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs">On-chain oracle</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            </div>
            <div className="flex items-center gap-1 text-[#229EDF] text-sm font-medium group-hover:gap-2 transition-all">
              View Details
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
