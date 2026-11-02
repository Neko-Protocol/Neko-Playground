"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { Search } from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { usePoolsData } from "@/features/pools/hooks/usePoolsData";
import type { PoolTypeFilter } from "@/features/pools/hooks/usePoolsData";
import { PoolCard } from "@/features/pools/components/ui/PoolCard";

const POOL_FILTERS: { label: string; value: PoolTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Lending", value: "lending" },
  { label: "AMM", value: "amm" },
];

const Pools: React.FC = () => {
  const router = useRouter();
  const {
    pools,
    isLoading,
    error,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
  } = usePoolsData();

  const isLendingType = (type: string) => type === "blend" || type === "neko";

  return (
    <PageContainer maxWidth="6xl" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Pools</h1>
        <p className="text-white/50 text-sm mt-1">
          Supply liquidity to earn fees and interest
        </p>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#1A1A1A]">
          {POOL_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setTypeFilter(f.value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                typeFilter === f.value
                  ? "bg-[#229EDF] text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {f.label}
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
        <span className="text-white/40 text-sm ml-auto">
          {pools.length} pool{pools.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <LoadingSpinner variant="dots" size="lg" />
          <span className="text-white/50 text-sm">Loading pools...</span>
        </div>
      ) : error ? (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-red-400 text-sm">Error: {String(error)}</p>
        </div>
      ) : pools.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-white/50">No pools found</p>
          {(searchQuery || typeFilter !== "all") && (
            <p className="text-white/30 text-sm mt-1">
              Try adjusting your search or filter
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((pool) => (
            <PoolCard
              key={pool.id}
              pool={pool}
              onDetailsClick={() => router.push(`/pools/${pool.id}`)}
              onLendClick={
                isLendingType(pool.type)
                  ? () => router.push("/lending")
                  : undefined
              }
              onSwapClick={
                pool.type === "soroswap"
                  ? () => router.push("/swap")
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default Pools;
