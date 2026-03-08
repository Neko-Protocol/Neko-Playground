"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ExternalLink,
} from "lucide-react";
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
import { PageContainer } from "@/components/ui/PageContainer";
import { ROUTES } from "../../constants/oracle";

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

  const stockInfo = React.useMemo(() => {
    const fromOracle = stockInfoFromOracle;
    const fromStatic = STOCK_INFO[symbolUpper];
    if (!fromStatic) return fromOracle;
    if (!fromOracle) return fromStatic;
    return {
      ...fromOracle,
      summary: fromStatic.summary,
      buyInfo: fromStatic.buyInfo,
    };
  }, [stockInfoFromOracle, symbolUpper]);

  if (!stockInfo) {
    return (
      <PageContainer
        maxWidth="5xl"
        className="animate__animated animate__fadeInRight"
      >
        <Link
          href={ROUTES.STOCKS_BASE}
          className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Discover
        </Link>
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
          <p className="text-white/40 text-lg">Asset not found</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      maxWidth="5xl"
      className="animate__animated animate__fadeInRight"
    >
      <Link
        href={ROUTES.STOCKS_BASE}
        className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Discover
      </Link>

      {priceError && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4 mb-6">
          <p className="text-red-400 font-semibold text-sm">
            Error loading price:{" "}
            {priceError instanceof Error ? priceError.message : "Unknown error"}
          </p>
        </div>
      )}

      {}
      <div className="rounded-2xl bg-[#229EDF] p-3 sm:p-4 mb-6">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          {}
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative w-11 h-11 sm:w-12 sm:h-12 rounded-lg bg-white/10 overflow-hidden shrink-0">
              <Image
                src={stockInfo.logo || "/assets/xlm-logo.png"}
                alt={stockInfo.name}
                fill
                unoptimized
                className="object-contain p-1.5"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white break-words">
                  {stockInfo.name}
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold shrink-0 border border-white/40 bg-white/10 text-white">
                  {symbolUpper}
                </span>
              </div>
              <p className="text-white/90 text-sm leading-snug mt-0.5">
                {stockInfo.description}
              </p>
            </div>
          </div>

          {}
          <div className="flex items-center justify-start gap-2 shrink-0 pt-2 sm:pt-0 border-t border-white/20 sm:border-t-0 lg:justify-end">
            {isLoadingPrice ? (
              <LoadingSpinner variant="spinner" size="md" />
            ) : currentPriceStr !== null ? (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-2xl sm:text-3xl font-bold text-white">
                  {currentPriceStr}
                </span>
                {priceHistory && priceHistory.length >= 2 && (
                  <div
                    className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold ${
                      isPositive
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-white"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                    {isPositive ? "+" : ""}
                    {priceChange.toFixed(2)}%
                  </div>
                )}
              </div>
            ) : (
              <p className="text-white/80 text-sm">No price data available</p>
            )}
          </div>
        </div>
      </div>

      {}
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-6 mb-6">
        <h3 className="text-base font-semibold text-white mb-3">About</h3>
        <p className="text-white/60 text-sm leading-relaxed">
          {stockInfo.summary ?? stockInfo.description}
        </p>
      </div>

      {}
      {stockInfo.buyInfo && (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-6 sm:p-8">
          <h3 className="text-base font-semibold text-white mb-2">
            Where to buy
          </h3>
          <p className="text-white/60 text-sm leading-relaxed mb-4 max-w-2xl">
            {stockInfo.buyInfo.description ??
              `Etherfuse bridges traditional finance and blockchain, offering tokenized government bonds (Stablebonds) and sovereign coins on Stellar, Solana, and Base. You can buy ${stockInfo.name} there with KYC and bank linking.`}
          </p>
          <a
            href={stockInfo.buyInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#229EDF" }}
          >
            {stockInfo.buyInfo.platform}
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      )}
    </PageContainer>
  );
};

export default AssetDetail;
