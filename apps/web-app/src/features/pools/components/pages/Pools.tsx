"use client";

import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { usePoolsData } from "@/features/pools/hooks/usePoolsData";
import { PoolCard } from "@/features/pools/components/ui/PoolCard";
import { BannerPage } from "@/components/ui/BannerPage";
import {
  getPoolCategory,
  type PoolCardData,
  type PoolTypeFilter,
} from "@/features/pools/types/pools";

function filterPools(pools: PoolCardData[], filter: PoolTypeFilter): PoolCardData[] {
  if (filter === "all") return pools;
  if (filter === "lending") {
    return pools.filter((p) => getPoolCategory(p.type) === "lending");
  }
  if (filter === "borrow") {
    return pools.filter((p) => p.supportedActions?.includes("borrow"));
  }
  if (filter === "amm") {
    return pools.filter((p) => getPoolCategory(p.type) === "amm");
  }
  return pools;
}

function PoolCardSkeleton() {
  return (
    <div className="rounded-3xl bg-neko-accent/60 p-6 shadow-lg border border-neko-border/30 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-14 h-8 rounded-full bg-neko-border/30" />
        <div className="flex-1">
          <div className="h-5 w-24 bg-neko-border/30 rounded mb-2" />
          <div className="h-4 w-16 bg-neko-border/20 rounded" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-neko-accent rounded-xl p-3 border border-white/10"
          >
            <div className="h-3 w-8 bg-neko-border/20 rounded mb-2" />
            <div className="h-5 w-14 bg-neko-border/30 rounded" />
          </div>
        ))}
      </div>
      <div className="h-12 bg-neko-border/20 rounded-2xl" />
    </div>
  );
}

const FILTER_TABS: { value: PoolTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lending", label: "Lending" },
  { value: "borrow", label: "Borrow" },
  { value: "amm", label: "AMM" },
];

const Pools: React.FC = () => {
  const router = useRouter();
  const [filter, setFilter] = useState<PoolTypeFilter>("all");
  const { pools, isLoading, error } = usePoolsData();

  const filteredPools = useMemo(
    () => filterPools(pools, filter),
    [pools, filter]
  );

  const isLendingType = (type: string) =>
    getPoolCategory(type) === "lending";
  const supportsBorrow = (pool: PoolCardData) =>
    pool.supportedActions?.includes("borrow");
  const isAmmType = (type: string) => getPoolCategory(type) === "amm";

  return (
    <div className="w-full min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <BannerPage
          title="Liquidity Pools"
          subtitle="Explore and join liquidity pools to earn fees"
        >
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors duration-200 ${
                  filter === tab.value
                    ? "bg-white/20 text-white border border-white/30"
                    : "bg-white/5 text-neko-muted hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </BannerPage>

        <div className="mt-8">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <PoolCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-3xl bg-neko-accent p-8 border border-neko-border/50 shadow-lg">
              <div className="text-center">
                <p className="text-red-300 text-lg font-semibold mb-2">
                  Error loading pools
                </p>
                <p className="text-neko-muted text-sm">{String(error)}</p>
              </div>
            </div>
          ) : filteredPools.length === 0 ? (
            <div className="rounded-3xl bg-neko-accent p-12 border border-neko-border/50 shadow-lg">
              <div className="text-center">
                <p className="text-white text-lg font-semibold mb-2">
                  {filter === "all"
                    ? "No pools available"
                    : `No ${filter} pools found`}
                </p>
                <p className="text-neko-muted text-sm">
                  {filter === "all"
                    ? "There are currently no active pools in the protocol."
                    : `Try selecting "All" to see all pool types.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPools.map((pool) => (
                <PoolCard
                  key={pool.id}
                  pool={pool}
                  onDetailsClick={() =>
                    router.push(`/dashboard/pools/${encodeURIComponent(pool.id)}`)
                  }
                  onLendClick={
                    isLendingType(pool.type)
                      ? () => router.push("/dashboard/lending")
                      : undefined
                  }
                  onBorrowClick={
                    supportsBorrow(pool)
                      ? () => router.push("/dashboard/borrowing")
                      : undefined
                  }
                  onAddLiquidityClick={
                    isAmmType(pool.type)
                      ? () =>
                          router.push(
                            `/dashboard/pools/${encodeURIComponent(pool.id)}`
                          )
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Pools;
