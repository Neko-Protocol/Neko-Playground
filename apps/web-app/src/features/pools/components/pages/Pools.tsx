"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { usePoolsData } from "@/features/pools/hooks/usePoolsData";
import { PoolCard } from "@/features/pools/components/ui/PoolCard";

const Pools: React.FC = () => {
  const router = useRouter();
  const { pools, isLoading, error } = usePoolsData();

  const isLendingType = (type: string) => type === "blend" || type === "neko";

  return (
    <div className="w-full min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-neko-navy tracking-tight mb-3">
            Liquidity Pools
          </h1>
          <p className="text-neko-blue text-lg leading-relaxed">
            Explore and join liquidity pools to earn fees
          </p>
        </div>

        {/* Pool Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-neko-border/30 border-t-neko-border mx-auto mb-4"></div>
              <p className="text-neko-blue text-lg">Loading pools...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center bg-red-50 rounded-2xl p-8 border border-red-200">
              <p className="text-red-600 text-lg font-semibold mb-2">
                Error loading pools
              </p>
              <p className="text-red-500 text-sm">{String(error)}</p>
            </div>
          </div>
        ) : pools.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center bg-neko-gray rounded-2xl p-8 border border-neko-border/20">
              <p className="text-neko-navy text-lg font-semibold mb-2">
                No pools available
              </p>
              <p className="text-neko-blue text-sm">
                There are currently no active pools in the contract.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pools;
