"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Search, Landmark, Droplets, TrendingUp } from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { TabGroup } from "@/components/ui/TabGroup";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { usePoolsData } from "@/features/pools/hooks/usePoolsData";
import type { PoolTypeFilter } from "@/features/pools/hooks/usePoolsData";
import { PoolCard } from "@/features/pools/components/ui/PoolCard";
import MyBalances from "@/features/pools/components/ui/MyBalances";

type PageTab = "pools" | "balances";

const POOL_FILTERS: {
  label: string;
  value: PoolTypeFilter;
  icon: React.ElementType;
}[] = [
  { label: "All Pools", value: "all", icon: Landmark },
  { label: "Lending", value: "lending", icon: TrendingUp },
  { label: "AMM", value: "amm", icon: Droplets },
];

const Pools: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PageTab>("pools");
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
              <Landmark className="h-3.5 w-3.5 text-[#229EDF]" />
              <span className="text-white/70 text-xs font-medium">
                DeFi Liquidity
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">
              Liquidity{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#229EDF] to-[#4ADE80]">
                Pools
              </span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-xl">
              Supply liquidity to earn fees and interest. Choose between lending
              pools and AMM pools.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabGroup
        tabs={[
          { key: "pools", label: "Pools" },
          { key: "balances", label: "My Positions" },
        ]}
        activeTab={activeTab}
        onChange={(key) => setActiveTab(key as PageTab)}
      />

      {activeTab === "pools" && (
        <>
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
              {POOL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                    typeFilter === f.value
                      ? "bg-[#229EDF] text-white shadow-lg shadow-[#229EDF]/20"
                      : "bg-[#1A1A1A] text-white/50 hover:text-white/80 hover:bg-[#242424] border border-white/5"
                  }`}
                >
                  <f.icon className="h-4 w-4" />
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                placeholder="Search by token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-[#229EDF]/50 transition-colors"
              />
            </div>
          </div>

          {/* Pool Stats */}
          <div className="flex items-center gap-6 px-5 py-4 rounded-xl bg-[#1A1A1A] border border-white/5">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-[#229EDF]" />
              <span className="text-white/50 text-sm">Total Pools:</span>
              <span className="text-white font-semibold">{pools.length}</span>
            </div>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
              <span className="text-white/50 text-sm">Active:</span>
              <span className="text-[#4ADE80] font-semibold">
                {pools.filter((p) => p.isActive).length}
              </span>
            </div>
          </div>

          {/* Pool Grid */}
          {isLoading ? (
            <div className="rounded-2xl bg-[#1A1A1A] border border-white/5 p-16 flex flex-col items-center justify-center gap-4">
              <LoadingSpinner variant="dots" size="lg" />
              <span className="text-white/60 text-base font-medium">
                Loading pools...
              </span>
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-[#EF4444]/10 border border-[#EF4444]/20 p-8 text-center">
              <p className="text-[#EF4444] font-semibold text-sm mb-2">
                Error loading pools
              </p>
              <p className="text-[#EF4444]/70 text-sm">{String(error)}</p>
            </div>
          ) : pools.length === 0 ? (
            <EmptyState
              icon={<Landmark className="h-8 w-8" />}
              title="No pools available"
              description={
                searchQuery || typeFilter !== "all"
                  ? "Try adjusting your filters or search query"
                  : "There are currently no active pools"
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
        </>
      )}

      {activeTab === "balances" && <MyBalances />}
    </PageContainer>
  );
};

export default Pools;
