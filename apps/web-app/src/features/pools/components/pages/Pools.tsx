"use client";

import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { Search } from "lucide-react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { usePoolsData } from "@/features/pools/hooks/usePoolsData";
import type { PoolTypeFilter } from "@/features/pools/hooks/usePoolsData";
import { PoolCard } from "@/features/pools/components/ui/PoolCard";
import MyBalances from "@/features/pools/components/ui/MyBalances";

type PageTab = "pools" | "balances";

const POOL_FILTERS: { label: string; value: PoolTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Lending", value: "lending" },
  { label: "AMM", value: "amm" },
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
    <PageContainer maxWidth="7xl">
      <BannerPage
        title="Liquidity Pools"
        subtitle="Explore and join liquidity pools to earn fees and interest on your assets"
        badge="Discover"
        imageSrc="/banners/lend.svg"
        imageAlt="Pools illustration"
        className="mb-8"
      />

      {/* Top-level tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-[#1C1C1C] p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab("pools")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            activeTab === "pools"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Pools
        </button>
        <button
          onClick={() => setActiveTab("balances")}
          className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${
            activeTab === "balances"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          My Positions
        </button>
      </div>

      {activeTab === "pools" && (
        <>
          {/* Pool type filters + search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              {POOL_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setTypeFilter(f.value)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    typeFilter === f.value
                      ? "bg-[#2A2A2A] text-white border border-white/10"
                      : "bg-transparent text-white/40 hover:text-white/70"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                type="text"
                placeholder="Search by token..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#2A2A2A] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors"
              />
            </div>
          </div>

          {/* Pool Cards Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-full max-w-md rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/10 border-t-[#229EDF] mx-auto mb-4" />
                <p className="text-white/40 text-sm">Loading pools...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-full max-w-md rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
                <p className="text-red-400 font-semibold text-sm mb-2">
                  Error loading pools
                </p>
                <p className="text-red-400/70 text-sm">{String(error)}</p>
              </div>
            </div>
          ) : pools.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-full max-w-md rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
                <p className="text-white/60 font-semibold text-sm mb-2">
                  No pools available
                </p>
                <p className="text-white/40 text-sm">
                  {searchQuery || typeFilter !== "all"
                    ? "Try adjusting your filters or search query."
                    : "There are currently no active pools."}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
              {pools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  onDetailsClick={() =>
                    router.push(`/dashboard/pools/${pool.id}`)
                  }
                  onLendClick={
                    isLendingType(pool.type)
                      ? () => router.push("/dashboard/lending")
                      : undefined
                  }
                  onSwapClick={
                    pool.type === "soroswap"
                      ? () => router.push("/dashboard/swap")
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
