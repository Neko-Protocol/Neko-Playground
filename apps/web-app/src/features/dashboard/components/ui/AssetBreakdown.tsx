"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";

const AssetBreakdown: React.FC = () => {
  const { assets, isLoading, error } = useDashboardPools();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Top Pools</h2>
        <Link
          href="/dashboard/pools"
          className="flex items-center gap-1 text-sm font-semibold text-neko-teal hover:text-neko-teal-light transition-colors"
        >
          View all pools
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[60px_1fr_100px_100px_120px] gap-2 px-5 py-3 bg-white/5 border-b border-white/5 text-xs font-semibold text-white/60 uppercase tracking-wider">
          <span>ID</span>
          <span>Pool</span>
          <span className="flex items-center gap-1">
            ROI
            <Info className="h-3 w-3 text-white/30" />
          </span>
          <span className="flex items-center gap-1">
            Fee APY
            <Info className="h-3 w-3 text-white/30" />
          </span>
          <span className="flex items-center gap-1">
            Liquidity
            <Info className="h-3 w-3 text-white/30" />
          </span>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10">
            <div className="w-5 h-5 border-2 border-neko-teal border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/40">Loading pools...</span>
          </div>
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-sm text-red-400">
              Error loading pools: {String(error)}
            </p>
          </div>
        ) : assets.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-white/40">No pools available</p>
            <p className="text-xs text-white/30 mt-1">
              There are currently no active pools in the contract.
            </p>
          </div>
        ) : (
          <div>
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="grid grid-cols-[60px_1fr_100px_100px_120px] gap-2 px-5 py-3.5 border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors"
              >
                {/* ID + status dot */}
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      asset.isActive ? "bg-green-400" : "bg-gray-500"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium truncate ${
                      asset.isActive ? "text-green-400" : "text-white/30"
                    }`}
                  >
                    {asset.id.length > 6
                      ? asset.id.slice(0, 6) + "..."
                      : asset.id}
                  </span>
                </div>

                {/* Pool pair */}
                <div className="flex items-center gap-2">
                  <div className="relative w-10 h-6 shrink-0">
                    <div className="absolute left-0 w-6 h-6 rounded-full bg-[#334EAC] border-2 border-[#1C1C1C]" />
                    <div className="absolute left-4 w-6 h-6 rounded-full bg-[#7096D1] border-2 border-[#1C1C1C]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {asset.pool.token1} / {asset.pool.token2}
                    </p>
                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-white/60">
                      {asset.pool.fee}
                    </span>
                  </div>
                </div>

                {/* ROI */}
                <div className="flex items-center">
                  <span className="text-sm text-white">{asset.roi}</span>
                </div>

                {/* Fee APY */}
                <div className="flex items-center">
                  <span className="text-sm text-white">
                    {asset.feeApy}
                  </span>
                </div>

                {/* Liquidity */}
                <div className="flex items-center">
                  <span className="text-sm text-white">
                    {asset.liquidity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetBreakdown;
