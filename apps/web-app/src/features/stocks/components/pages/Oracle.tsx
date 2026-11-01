"use client";

import React, { useState, useMemo } from "react";
import type { Asset } from "@neko/oracle";
import { useOracle } from "../../hooks/useOracle";
import { formatAsset } from "../../utils/oracleUtils";
import { AssetPriceCard } from "../ui/AssetPriceCard";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Search,
  Building2,
  Globe,
  TrendingUp,
  Coins,
  Filter,
} from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";

type AssetFilter = "all" | "treasury" | "stablecoin" | "yield";

const FILTERS: { key: AssetFilter; label: string; icon: React.ElementType }[] =
  [
    { key: "all", label: "All Assets", icon: Coins },
    { key: "treasury", label: "Treasuries", icon: Building2 },
    { key: "stablecoin", label: "Stablecoins", icon: Globe },
    { key: "yield", label: "Yield Tokens", icon: TrendingUp },
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
        if (category !== activeFilter) {
          return false;
        }
      }

      return true;
    });
  }, [assets, searchQuery, activeFilter]);

  return (
    <PageContainer maxWidth="7xl" className="space-y-8">
      {/* Hero Section */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#0D1B2A] via-[#1B2838] to-[#0D1B2A] overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full bg-[#229EDF] blur-[80px]" />
          <div className="absolute bottom-1/4 right-1/3 w-32 h-32 rounded-full bg-[#4ADE80] blur-[60px]" />
        </div>

        <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
              <span className="text-white/70 text-xs font-medium">
                Live Oracle Prices
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">
              Tokenized Asset{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#229EDF] to-[#4ADE80]">
                Catalog
              </span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-xl">
              Explore real-world assets tokenized on Stellar. Real-time pricing
              from on-chain oracles.
            </p>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveFilter(filter.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                activeFilter === filter.key
                  ? "bg-[#229EDF] text-white shadow-lg shadow-[#229EDF]/20"
                  : "bg-[#1A1A1A] text-white/50 hover:text-white/80 hover:bg-[#242424] border border-white/5"
              }`}
            >
              <filter.icon className="h-4 w-4" />
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          <input
            type="text"
            placeholder="Search assets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#229EDF]/50 transition-colors"
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-5 py-4 rounded-xl bg-[#1A1A1A] border border-white/5">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-[#229EDF]" />
          <span className="text-white/50 text-sm">Total Assets:</span>
          <span className="text-white font-semibold">
            {filteredAssets.length}
          </span>
        </div>
        <div className="w-px h-5 bg-white/10" />
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
          <span className="text-white/50 text-sm">Oracle Status:</span>
          <span className="text-[#4ADE80] font-semibold">Active</span>
        </div>
      </div>

      {/* Error State */}
      {assetsError && (
        <div className="rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 p-5">
          <p className="text-[#EF4444] font-semibold text-sm">
            Error loading assets:{" "}
            {assetsError instanceof Error
              ? assetsError.message
              : "Unknown error"}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="rounded-2xl bg-[#1A1A1A] border border-white/5 p-16 flex flex-col items-center justify-center gap-4">
          <LoadingSpinner variant="dots" size="lg" />
          <span className="text-white/60 text-base font-medium">
            Loading assets from oracle...
          </span>
        </div>
      ) : filteredAssets.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredAssets.map((asset: Asset) => (
            <AssetPriceCard
              key={formatAsset(asset)}
              asset={asset}
              decimals={decimals}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Filter className="h-8 w-8" />}
          title="No assets found"
          description={
            searchQuery || activeFilter !== "all"
              ? "Try adjusting your search or filter criteria"
              : "No tokenized assets are currently available"
          }
        />
      )}
    </PageContainer>
  );
};

export default OracleVisualizer;
