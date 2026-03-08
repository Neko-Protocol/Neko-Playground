"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Asset } from "@neko/oracle";
import { useOracleAssetPrice } from "../../hooks/useOracleAssetPrice";
import { formatPrice, calculatePriceChange } from "../../utils/oracleUtils";
import {
  ROUTES,
  MAX_RECENT_PRICES_IN_CARD,
  TIMESTAMP_MS_PER_SECOND,
} from "../../constants/oracle";
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

  return (
    <Link href={ROUTES.stockDetail(assetStr)} className="block h-full group">
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 h-full flex flex-col transition-all duration-200 hover:border-white/10 hover:bg-[#222222] cursor-pointer">
        {}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            {stockInfo && (
              <div className="relative w-10 h-10 rounded-xl bg-[#2A2A2A] overflow-hidden shrink-0">
                <Image
                  src={stockInfo.logo || "/assets/xlm-logo.png"}
                  alt={stockInfo.name}
                  fill
                  unoptimized
                  className="object-contain p-1.5"
                />
              </div>
            )}
            <div>
              <h3 className="text-white font-semibold text-sm leading-tight">
                {stockInfo ? stockInfo.name : assetStr}
              </h3>
              <span
                className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
                style={{
                  color: "#229EDF",
                  backgroundColor: "rgba(34,158,223,0.10)",
                }}
              >
                {assetStr}
              </span>
            </div>
          </div>

          {priceChange !== null && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
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
              {formatPctChange(Math.abs(priceChange))}%
            </div>
          )}
        </div>

        {}
        <div className="flex-1 flex flex-col">
          {isLoadingPrice ? (
            <div className="flex items-center gap-2">
              <LoadingSpinner variant="dots" size="sm" />
              <span className="text-white/40 text-xs">Loading price…</span>
            </div>
          ) : lastPrice ? (
            <div>
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-1">
                Last Price
              </p>
              <p className="text-white text-3xl font-bold">
                {formatPrice(lastPrice.price, displayDecimals)}
              </p>
              <p className="text-white/30 text-xs mt-1">
                {new Date(
                  Number(lastPrice.timestamp) * TIMESTAMP_MS_PER_SECOND
                ).toLocaleDateString()}
              </p>
            </div>
          ) : (
            <p className="text-white/30 text-sm">No price data</p>
          )}

          {}
          {priceHistory && priceHistory.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/5">
              <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-3">
                Recent Prices ({priceHistory.length})
              </p>
              <div className="space-y-2">
                {priceHistory
                  .slice(0, MAX_RECENT_PRICES_IN_CARD)
                  .map((price, idx) => (
                    <div
                      key={`${Number(price.timestamp)}-${idx}`}
                      className="flex justify-between items-center"
                    >
                      <span className="text-white text-sm font-medium">
                        {formatPrice(price.price, displayDecimals)}
                      </span>
                      <span className="text-white/30 text-xs">
                        {new Date(
                          Number(price.timestamp) * TIMESTAMP_MS_PER_SECOND
                        ).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
