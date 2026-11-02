"use client";

import React, { useState, useMemo } from "react";
import type { Asset } from "@neko/oracle";
import { useOracle } from "../../hooks/useOracle";
import { formatAsset } from "../../utils/oracleUtils";
import { AssetPriceCard } from "../ui/AssetPriceCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { Search } from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";

type AssetFilter = "all" | "treasury" | "stablecoin" | "yield";

const FILTERS: { key: AssetFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "treasury", label: "Treasuries" },
  { key: "stablecoin", label: "Stablecoins" },
  { key: "yield", label: "Yield" },
];

const ASSET_CATEGORIES: Record<string, AssetFilter> = {
  USTRY: "treasury",
  TESOURO: "treasury",
  CETES: "treasury",
  KTB: "treasury",
  PYUSD: "stablecoin",
  USDY: "yield",
};

const OracleVisualizer: React.FC = () => {
  const { assets, decimals, isLoading, assetsError } = useOracle();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<AssetFilter>("all");

  const filteredAssets = useMemo(() => {
    const baseFiltered =
      assets?.filter((asset: Asset) => formatAsset(asset) !== "0") ?? [];

    return baseFiltered.filter((asset: Asset) => {
      const assetStr = formatAsset(asset).toUpperCase();
      if (searchQuery && !assetStr.includes(searchQuery.toUpperCase())) {
        return false;
      }
      if (activeFilter !== "all") {
        const category = ASSET_CATEGORIES[assetStr] || "yield";
        if (category !== activeFilter) return false;
      }
      return true;
    });
  }, [assets, searchQuery, activeFilter]);

  return (
    <PageContainer maxWidth="6xl" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Explore Assets</h1>
          <p className="text-white/50 text-sm mt-1">
            Browse tokenized real-world assets with live oracle prices
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
          <span className="text-white/50">Oracle active</span>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1A1A1A]">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeFilter === filter.key
                  ? "bg-[#229EDF] text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#229EDF]/50"
          />
        </div>
      </div>

      {/* Error */}
      {assetsError && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-red-400 text-sm">
            Error loading assets:{" "}
            {assetsError instanceof Error
              ? assetsError.message
              : "Unknown error"}
          </p>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <LoadingSpinner variant="dots" size="lg" />
          <span className="text-white/50 text-sm">Loading assets...</span>
        </div>
      ) : filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset: Asset) => (
            <AssetPriceCard
              key={formatAsset(asset)}
              asset={asset}
              decimals={decimals}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <p className="text-white/50">No assets found</p>
          {(searchQuery || activeFilter !== "all") && (
            <p className="text-white/30 text-sm mt-1">
              Try adjusting your search or filter
            </p>
          )}
        </div>
      )}
    </PageContainer>
  );
};

export default OracleVisualizer;
