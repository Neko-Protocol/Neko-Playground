"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Asset } from "@neko/oracle";
import { useOracle } from "@/features/stocks/hooks/useOracle";
import { formatAsset } from "@/features/stocks/utils/oracleUtils";
import { AssetPriceCard } from "@/features/stocks/components/ui/AssetPriceCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

const DASHBOARD_ASSET_LIMIT = 3;

const DiscoverAssets: React.FC = () => {
  const { assets, decimals, isLoading } = useOracle();

  const filteredAssets = React.useMemo(
    () => (assets ?? []).filter((asset: Asset) => formatAsset(asset) !== "0"),
    [assets]
  );

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Discover Assets
          </h2>
          <p className="text-white/40 text-sm">
            Live price feeds from the oracle
          </p>
        </div>
        <Link
          href="/discover"
          className="flex items-center gap-1.5 text-sm font-semibold text-white/40 hover:text-white transition-colors"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 flex flex-col items-center justify-center gap-4">
          <LoadingSpinner variant="dots" size="lg" />
          <span className="text-white/60 text-base font-medium">
            Loading assets...
          </span>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
          <p className="text-white/40 text-base">
            No assets found in the oracle
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredAssets
            .slice(0, DASHBOARD_ASSET_LIMIT)
            .map((asset: Asset) => (
              <AssetPriceCard
                key={formatAsset(asset)}
                asset={asset}
                decimals={decimals}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default DiscoverAssets;
