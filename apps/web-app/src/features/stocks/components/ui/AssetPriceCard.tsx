"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { Asset } from "@neko/oracle";
import { useOracleAssetPrice } from "../../hooks/useOracleAssetPrice";
import { formatPrice, calculatePriceChange } from "../../utils/oracleUtils";
import { ROUTES } from "../../constants/oracle";
import { MAX_RECENT_PRICES_IN_CARD } from "../../constants/oracle";
import { TIMESTAMP_MS_PER_SECOND } from "../../constants/oracle";
import { STOCK_INFO } from "../../utils/stockInfo";
import type { StockInfo } from "../../types/stocks";
import { useStockInfo } from "../../hooks/useStockInfo";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export interface AssetPriceCardProps {
  asset: Asset;
  decimals?: number;
  /** Optional static metadata; when provided, overrides hook/static lookup. */
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
    const currentPrice = Number(lastPrice.price);
    const previousPrice = Number(priceHistory[1].price);
    return calculatePriceChange(currentPrice, previousPrice);
  }, [lastPrice, priceHistory]);

  const displayDecimals = decimals ?? 14;

  return (
    <Link href={ROUTES.stockDetail(assetStr)} className="block h-full group">
      <div className="rounded-2xl bg-white p-6 shadow-md border border-gray-200 transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:border-neko-border/30 overflow-hidden cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            {stockInfo && (
              <div className="relative w-12 h-12 rounded-xl bg-gray-100 overflow-hidden">
                <Image
                  src={stockInfo.logo || "/placeholder.svg"}
                  alt={stockInfo.name}
                  fill
                  unoptimized
                  className="object-contain p-2"
                />
              </div>
            )}
            <div>
              <h3 className="text-xl font-bold text-black mb-1">
                {stockInfo ? stockInfo.name : assetStr}
              </h3>
              {stockInfo ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-neko-teal/10 text-neko-teal">
                  {assetStr}
                </span>
              ) : asset.tag === "Stellar" ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-neko-teal/10 text-neko-teal">
                  Stellar
                </span>
              ) : null}
            </div>
          </div>
          {priceChange !== null && (
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm font-semibold ${
                priceChange >= 0
                  ? "bg-green-500/10 text-green-600"
                  : "bg-red-500/10 text-red-600"
              }`}
            >
              {priceChange >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {Math.abs(priceChange).toFixed(2)}%
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {isLoadingPrice ? (
            <div className="flex items-center gap-2">
              <LoadingSpinner
                variant="dots"
                size="sm"
                className="bg-neko-teal/60"
              />
              <span className="text-gray-500 text-sm">Loading price...</span>
            </div>
          ) : lastPrice ? (
            <div className="flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">
                Last Price
              </p>
              <p className="text-3xl font-bold text-black mb-2">
                {formatPrice(lastPrice.price, displayDecimals)}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(
                  Number(lastPrice.timestamp) * TIMESTAMP_MS_PER_SECOND
                ).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No price data available</p>
          )}

          {priceHistory && priceHistory.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
                Recent Prices ({priceHistory.length})
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {priceHistory
                  .slice(0, MAX_RECENT_PRICES_IN_CARD)
                  .map((price, idx) => (
                    <div
                      key={`${Number(price.timestamp)}-${idx}`}
                      className="flex justify-between text-sm items-center"
                    >
                      <span className="font-medium text-black">
                        {formatPrice(price.price, displayDecimals)}
                      </span>
                      <span className="text-xs text-gray-500">
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
