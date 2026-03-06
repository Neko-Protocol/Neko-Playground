"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import { useOracle } from "../../hooks/useOracle";
import { useOracleAssetPrice } from "../../hooks/useOracleAssetPrice";
import { formatAsset } from "../../utils/oracleUtils";
import { formatPrice, calculatePriceChange } from "../../utils/oracleUtils";
import { STOCK_INFO } from "../../utils/stockInfo";
import { useStockInfo } from "../../hooks/useStockInfo";
import type { Asset } from "@neko/oracle";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PriceChart } from "../ui/PriceChart";
import { PageContainer } from "@/components/ui/PageContainer";
import { ROUTES } from "../../constants/oracle";
import { TIMESTAMP_MS_PER_SECOND } from "../../constants/oracle";
import type { PriceChartDatum } from "../../types/stocks";

const AssetDetail: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const symbol = params?.symbol as string | undefined;

  const { assets } = useOracle();

  const symbolUpper = typeof symbol === "string" ? symbol.toUpperCase() : "";
  const stockInfoFromOracle = useStockInfo(symbolUpper);
  const asset = React.useMemo(() => {
    if (!assets || !symbolUpper) return null;
    return assets.find((a: Asset) => {
      const assetStr = formatAsset(a);
      return assetStr.toUpperCase() === symbolUpper;
    });
  }, [assets, symbolUpper]);

  const defaultAsset: Asset = {
    tag: "Stellar",
    values: [symbolUpper],
  };

  const {
    lastPrice,
    priceHistory,
    isLoadingPrice,
    decimals,
    error: priceError,
  } = useOracleAssetPrice(asset || defaultAsset);

  const chartData = React.useMemo((): PriceChartDatum[] => {
    if (!priceHistory || priceHistory.length === 0) return [];
    const divisor = Math.pow(10, decimals);
    const sortedHistory = [...priceHistory].sort(
      (a, b) => Number(a.timestamp) - Number(b.timestamp)
    );
    return sortedHistory.map((p) => {
      const priceNum = Number(p.price) / divisor;
      const date = new Date(Number(p.timestamp) * TIMESTAMP_MS_PER_SECOND);
      const dateStr = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return {
        timestamp: `${dateStr} ${timeStr}`,
        price: priceNum,
        fullTimestamp: Number(p.timestamp) * TIMESTAMP_MS_PER_SECOND,
        date,
      };
    });
  }, [priceHistory, decimals]);

  const priceChange = React.useMemo(() => {
    if (!priceHistory || priceHistory.length < 2) return 0;
    const latest = priceHistory[priceHistory.length - 1];
    const oldest = priceHistory[0];
    const divisor = Math.pow(10, decimals);
    const currentPriceVal = Number(latest.price) / divisor;
    const previousPrice = Number(oldest.price) / divisor;
    const change = calculatePriceChange(currentPriceVal, previousPrice);
    return change ?? 0;
  }, [priceHistory, decimals]);

  const currentPriceStr = React.useMemo(() => {
    if (lastPrice) {
      return formatPrice(lastPrice.price, decimals);
    }
    if (priceHistory && priceHistory.length > 0) {
      const latest = priceHistory[priceHistory.length - 1];
      return formatPrice(latest.price, decimals);
    }
    return null;
  }, [lastPrice, priceHistory, decimals]);

  const isPositive = priceChange >= 0;

  React.useEffect(() => {
    if (!symbol) {
      void router.push(ROUTES.STOCKS_BASE);
    }
  }, [symbol, router]);

  if (!symbol) {
    return null;
  }

  const stockInfo = stockInfoFromOracle ?? STOCK_INFO[symbolUpper];

  if (!stockInfo) {
    return (
      <PageContainer maxWidth="5xl">
        <Link
          href={ROUTES.STOCKS_BASE}
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
          <p className="text-white/40 text-lg">Asset not found</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="5xl">
      <Link
        href={ROUTES.STOCKS_BASE}
        className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {priceError && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 mb-6">
          <p className="text-red-400 font-semibold text-sm">
            Error loading price:{" "}
            {priceError instanceof Error ? priceError.message : "Unknown error"}
          </p>
        </div>
      )}

      {/* Asset header card */}
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-6 mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-16 h-16 rounded-2xl bg-[#2A2A2A] overflow-hidden shrink-0">
              <Image
                src={stockInfo.logo || "/placeholder.svg"}
                alt={stockInfo.name}
                fill
                unoptimized
                className="object-contain p-3"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h1 className="text-2xl font-bold text-white truncate">
                  {stockInfo.name}
                </h1>
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold shrink-0"
                  style={{
                    color: "#229EDF",
                    backgroundColor: "rgba(34,158,223,0.10)",
                  }}
                >
                  {symbolUpper}
                </span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed line-clamp-2">
                {stockInfo.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {isLoadingPrice ? (
              <LoadingSpinner variant="spinner" size="md" />
            ) : currentPriceStr !== null ? (
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-white">
                  {currentPriceStr}
                </span>
                {priceHistory && priceHistory.length >= 2 && (
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold ${
                      isPositive
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {isPositive ? "+" : ""}
                    {priceChange.toFixed(2)}%
                  </div>
                )}
              </div>
            ) : (
              <p className="text-white/40 text-sm">No price data available</p>
            )}
          </div>
        </div>
      </div>

      {/* Price history */}
      <div>
        <h2 className="text-xl font-bold text-white mb-5">Price History</h2>
        {isLoadingPrice ? (
          <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 flex items-center justify-center py-16">
            <LoadingSpinner variant="spinner" size="lg" />
          </div>
        ) : (
          <PriceChart data={chartData} height={400} />
        )}
      </div>
    </PageContainer>
  );
};

export default AssetDetail;
