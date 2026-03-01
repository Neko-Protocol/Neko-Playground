"use client";

import React from "react";
import type { Asset } from "@neko/oracle";
import { useOracle } from "../../hooks/useOracle";
import { formatAsset } from "../../utils/oracleUtils";
import { StatCard } from "../ui/StatCard";
import { AssetPriceCard } from "../ui/AssetPriceCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Activity, Database, Clock, Layers } from "lucide-react";
import { MAX_ASSETS_DISPLAY } from "../../constants/oracle";
import { BannerPage } from "@/components/ui/BannerPage";

const OracleVisualizer: React.FC = () => {
  const {
    assets,
    baseAsset,
    decimals,
    resolution,
    isLoading,
    isLoadingBase,
    isLoadingDecimals,
    isLoadingResolution,
    isLoadingAssets,
    assetsError,
  } = useOracle();

  const filteredAssets =
    assets?.filter((asset: Asset) => formatAsset(asset) !== "0") ?? [];

  return (
    <div className="w-full min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <BannerPage
          title="Discover Assets"
          subtitle="Real-time price data and RWA metadata from the RWACLE"
          badge="See prices in real time"
          imageSrc="/banners/oracle.svg"
          imageAlt="Discover Assets illustration"
          className="mb-10"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          <StatCard
            icon={<Database className="h-5 w-5" />}
            label="Base Asset"
            value={
              baseAsset !== undefined && baseAsset !== null
                ? formatAsset(baseAsset)
                : "N/A"
            }
            isLoading={isLoadingBase}
          />

          <StatCard
            icon={<Layers className="h-5 w-5" />}
            label="Decimals"
            value={decimals !== undefined ? decimals : "N/A"}
            isLoading={isLoadingDecimals}
          />

          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Resolution"
            value={resolution !== undefined ? `${resolution}s` : "N/A"}
            isLoading={isLoadingResolution}
          />

          <StatCard
            icon={<Activity className="h-5 w-5" />}
            label="Total Assets"
            value={assets ? assets.length : "0"}
            isLoading={isLoadingAssets}
          />
        </div>

        {assetsError && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5 mb-8">
            <p className="text-red-400 font-semibold text-sm">
              Error loading assets:{" "}
              {assetsError instanceof Error ? assetsError.message : "Unknown error"}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 flex flex-col items-center justify-center gap-4">
            <LoadingSpinner variant="dots" size="lg" />
            <span className="text-white/60 text-base font-medium">Loading oracle data…</span>
          </div>
        ) : filteredAssets.length > 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">Assets & Prices</h2>
              <p className="text-white/40 text-sm">Live price feeds from the oracle</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredAssets.slice(0, MAX_ASSETS_DISPLAY).map((asset: Asset) => (
                <AssetPriceCard
                  key={formatAsset(asset)}
                  asset={asset}
                  decimals={decimals}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
            <p className="text-white/40 text-base">No assets found in the oracle</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OracleVisualizer;
