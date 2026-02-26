"use client";

import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { usePools } from "@/lib/orchestrator";
import type { PoolInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/stellar/swapUtils";

interface PoolCardData {
  id: string;
  token1: string;
  token2: string;
  fee: string;
  roi: string;
  feeApy: string;
  liquidity: string;
  isActive: boolean;
  type: string;
}

const Pools: React.FC = () => {
  const router = useRouter();

  const { data: allPools = [], isLoading, error } = usePools();

  const pools: PoolCardData[] = useMemo(() => {
    return allPools.map((pool: PoolInfo) => {
      const token1 = pool.tokens[0]?.code ?? "?";
      const token2 =
        pool.tokens.length > 1
          ? (pool.tokens[1]?.code ?? "?")
          : pool.type === "blend"
            ? "Lending"
            : "?";

      const decimals = pool.tokens[0]?.decimals ?? 7;
      const tvlHuman = parseFloat(
        fromSmallestUnit(pool.tvl.toString(), decimals)
      );
      const liquidity =
        tvlHuman >= 1_000_000
          ? `$${(tvlHuman / 1_000_000).toFixed(2)}M`
          : tvlHuman >= 1_000
            ? `$${(tvlHuman / 1_000).toFixed(2)}k`
            : `$${tvlHuman.toFixed(2)}`;

      const apy = pool.apy > 0 ? `${pool.apy.toFixed(2)}%` : "0.00%";

      return {
        id: pool.id,
        token1,
        token2,
        fee: "0%",
        roi: apy,
        feeApy: apy,
        liquidity,
        isActive: pool.state === "active",
        type: pool.type,
      };
    });
  }, [allPools]);

  return (
    <div className="w-full min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-[#081F5C] tracking-tight mb-3">
            Liquidity Pools
          </h1>
          <p className="text-[#7096D1] text-lg leading-relaxed">
            Explore and join liquidity pools to earn fees
          </p>
        </div>

        {/* Pool Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#334EAC]/30 border-t-[#334EAC] mx-auto mb-4"></div>
              <p className="text-[#7096D1] text-lg">Loading pools...</p>
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
            <div className="text-center bg-[#f3f4f6] rounded-2xl p-8 border border-[#334EAC]/20">
              <p className="text-[#081F5C] text-lg font-semibold mb-2">
                No pools available
              </p>
              <p className="text-[#7096D1] text-sm">
                There are currently no active pools in the contract.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {pools.map((pool) => (
              <div
                key={pool.id}
                className="rounded-3xl bg-[#294cab] p-6 shadow-lg border border-[#334EAC]/50 hover:border-[#39bfb7] transition-all duration-300 hover:shadow-xl relative overflow-hidden group"
              >
                {/* Background decoration */}
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-[#334EAC]/20 rounded-full blur-2xl pointer-events-none"></div>

                {/* Header with Pool Info */}
                <div className="relative z-10 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="relative w-14 h-8">
                        <div className="absolute left-0 w-8 h-8 rounded-full bg-[#39bfb7] border-2 border-[#334EAC] flex items-center justify-center text-white text-sm font-bold shadow-md">
                          {pool.token1[0]}
                        </div>
                        <div className="absolute left-6 w-8 h-8 rounded-full bg-[#68f9f2] border-2 border-[#334EAC] flex items-center justify-center text-[#081F5C] text-sm font-bold shadow-md">
                          {pool.token2[0]}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-white text-xl font-bold">
                          {pool.token1} / {pool.token2}
                        </h3>
                        <div className="inline-block bg-white/10 text-white text-xs font-semibold px-2 py-1 rounded-md mt-1">
                          {pool.type === "blend" ? "Lending" : "AMM"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="relative z-10 space-y-4 mb-6">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[#294cab] rounded-xl p-3 border border-white/10">
                      <p className="text-[#BAD6EB] text-xs mb-1">ROI</p>
                      <p className="text-white text-lg font-bold">{pool.roi}</p>
                    </div>
                    <div className="bg-[#294cab] rounded-xl p-3 border border-white/10">
                      <p className="text-[#BAD6EB] text-xs mb-1">Fee APY</p>
                      <p className="text-white text-lg font-bold">
                        {pool.feeApy}
                      </p>
                    </div>
                    <div className="bg-[#294cab] rounded-xl p-3 border border-white/10">
                      <p className="text-[#BAD6EB] text-xs mb-1">Liquidity</p>
                      <p className="text-white text-lg font-bold">
                        {pool.liquidity}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pool Details / Dashboard Link */}
                <div
                  className="relative z-10 bg-white rounded-2xl p-4 mb-4 border border-[#334EAC]/30 hover:bg-[#f3f4f6] cursor-pointer transition-colors duration-200"
                  onClick={() => {
                    router.push(`/dashboard/pools/${pool.id}`);
                  }}
                >
                  <div className="flex items-center justify-center">
                    <button className="text-black px-3 py-1 rounded-lg text-sm font-semibold duration-200 flex items-center gap-1">
                      Pool Details <span className="opacity-70">&rarr;</span>
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="relative z-10 flex">
                  <button
                    className="flex-1 bg-[#081F5C] hover:bg-[#12328a] text-[#FFF9F0] px-4 py-3 rounded-xl text-sm font-bold transition-colors duration-200 border border-[#334EAC]/30"
                    onClick={() => {
                      router.push("/dashboard/lending");
                    }}
                  >
                    Lend
                  </button>
                </div>

                {/* Status Indicator */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      pool.isActive ? "bg-[#39bfb7]" : "bg-gray-400"
                    } animate-pulse`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Pools;
