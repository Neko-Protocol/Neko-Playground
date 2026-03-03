"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import type { Asset } from "@neko/oracle";
import { useOracle } from "@/features/stocks/hooks/useOracle";
import { useOracleAssetPrice } from "@/features/stocks/hooks/useOracleAssetPrice";
import {
  formatAsset,
  formatPrice,
  calculatePriceChange,
} from "@/features/stocks/utils/oracleUtils";
import { STOCK_INFO } from "@/features/stocks/utils/stockInfo";
import { ROUTES } from "@/features/stocks/constants/oracle";

const DASHBOARD_ASSET_LIMIT = 4;

function AssetMiniCard({
  asset,
  decimals,
}: {
  asset: Asset;
  decimals?: number;
}) {
  const { lastPrice, priceHistory, isLoadingPrice, assetStr } =
    useOracleAssetPrice(asset, { decimals });

  const stockInfo = STOCK_INFO[assetStr.toUpperCase()];

  const priceChange = React.useMemo(() => {
    if (!lastPrice || !priceHistory || priceHistory.length < 2) return null;
    return calculatePriceChange(
      Number(lastPrice.price),
      Number(priceHistory[1].price)
    );
  }, [lastPrice, priceHistory]);

  const displayDecimals = decimals ?? 14;

  return (
    <Link
      href={ROUTES.stockDetail(assetStr)}
      className="group rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 transition-all hover:border-white/10 hover:bg-[#222222] hover:-translate-y-0.5 flex flex-col"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {stockInfo && (
            <div className="relative w-8 h-8 rounded-lg bg-[#2A2A2A] overflow-hidden shrink-0">
              <Image
                src={stockInfo.logo || "/placeholder.svg"}
                alt={stockInfo.name}
                fill
                unoptimized
                className="object-contain p-1"
              />
            </div>
          )}
          <div>
            <p className="text-sm font-bold text-white leading-tight">
              {assetStr}
            </p>
            {stockInfo && (
              <p className="text-[10px] text-white/40 leading-tight mt-0.5">
                {stockInfo.name}
              </p>
            )}
          </div>
        </div>

        {priceChange !== null && (
          <div
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
              priceChange >= 0
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {priceChange >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(priceChange).toFixed(2)}%
          </div>
        )}
      </div>

      {isLoadingPrice ? (
        <div className="h-6 w-24 rounded bg-white/5 animate-pulse" />
      ) : lastPrice ? (
        <p className="text-lg font-bold text-white">
          {formatPrice(lastPrice.price, displayDecimals)}
        </p>
      ) : (
        <p className="text-sm text-white/30">No price data</p>
      )}
    </Link>
  );
}

const DiscoverAssets: React.FC = () => {
  const { assets, decimals, isLoading } = useOracle();

  const filteredAssets = React.useMemo(
    () =>
      (assets ?? []).filter(
        (asset: Asset) => formatAsset(asset) !== "0"
      ),
    [assets]
  );

  if (isLoading) {
    return (
      <div className="w-full">
        <h2 className="text-lg font-bold text-white mb-4">
          Discover Assets
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: DASHBOARD_ASSET_LIMIT }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 h-28 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-white/5" />
                <div className="h-4 w-16 rounded bg-white/5" />
              </div>
              <div className="h-6 w-24 rounded bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filteredAssets.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Discover Assets</h2>
        <Link
          href="/dashboard/stocks"
          className="flex items-center gap-1 text-sm font-semibold text-neko-teal hover:text-neko-teal-light transition-colors"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {filteredAssets.slice(0, DASHBOARD_ASSET_LIMIT).map((asset: Asset) => (
          <AssetMiniCard
            key={formatAsset(asset)}
            asset={asset}
            decimals={decimals}
          />
        ))}
      </div>
    </div>
  );
};

export default DiscoverAssets;
