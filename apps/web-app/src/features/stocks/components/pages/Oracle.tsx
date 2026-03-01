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
        <div className="mb-10">
          <h1 className="text-5xl font-bold text-neko-navy tracking-tight mb-3">
            Oracle Dashboard
          </h1>
          <p className="text-neko-blue text-lg leading-relaxed">
            Real-time price data and RWA metadata from the RWACLE
          </p>
        </div>

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
          <div className="rounded-2xl bg-red-50 p-6 shadow-md border border-red-200 mb-8">
            <p className="text-red-600 font-semibold">
              Error loading assets:{" "}
              {assetsError instanceof Error
                ? assetsError.message
                : "Unknown error"}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl bg-gradient-to-br from-neko-accent to-neko-border p-12 shadow-xl">
            <div className="flex flex-col items-center justify-center gap-4">
              <LoadingSpinner variant="dots" size="lg" />
              <span className="text-white text-lg font-medium">
                Loading oracle data...
              </span>
            </div>
          </div>
        ) : filteredAssets.length > 0 ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-neko-navy mb-2">
                Assets & Prices
              </h2>
              <p className="text-neko-blue text-base">
                Live price feeds from the oracle
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssets
                .slice(0, MAX_ASSETS_DISPLAY)
                .map((asset: Asset) => (
                  <AssetPriceCard
                    key={formatAsset(asset)}
                    asset={asset}
                    decimals={decimals}
                  />
                ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-neko-accent to-neko-border p-12 shadow-xl text-center">
            <p className="text-white text-lg font-medium">
              No assets found in the oracle
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OracleVisualizer;
