"use client";

import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Hash,
  Layers,
  TrendingUp,
  Percent,
  Droplets,
} from "lucide-react";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";

function ColHeader({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <th className="px-4 py-3 text-left">
      <div className="flex items-center gap-1.5 text-white/40 text-xs font-semibold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
    </th>
  );
}

const AssetBreakdown: React.FC = () => {
  const { assets, isLoading, error } = useDashboardPools();

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">Top Pools</h2>
          <p className="text-white/40 text-sm">
            Overview of the most active pools
          </p>
        </div>
        <Link
          href="/dashboard/pools"
          className="flex items-center gap-1.5 text-sm font-semibold text-white/40 hover:text-white transition-colors"
        >
          View all pools
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <ColHeader icon={Hash} label="ID" />
              <ColHeader icon={Layers} label="Pool" />
              <ColHeader icon={TrendingUp} label="ROI" />
              <ColHeader icon={Percent} label="Fee APY" />
              <ColHeader icon={Droplets} label="Liquidity" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white/60" />
                    <span className="text-white/40 text-sm">
                      Loading pools...
                    </span>
                  </div>
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-red-400 text-sm">
                    Error loading pools: {String(error)}
                  </p>
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center">
                  <p className="text-white/40 text-sm">No pools available</p>
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/2 transition-colors"
                >
                  {/* ID */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        asset.isActive
                          ? "text-[#76C464]"
                          : "bg-white/5 text-white/40"
                      }`}
                      style={
                        asset.isActive
                          ? {
                              backgroundColor: "rgba(118,196,100,0.30)",
                            }
                          : undefined
                      }
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          asset.isActive ? "bg-[#76C464]" : "bg-white/20"
                        }`}
                      />
                      {asset.id.length > 10
                        ? asset.id.slice(0, 10) + "…"
                        : asset.id}
                    </span>
                  </td>

                  {/* Pool */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="relative w-9 h-6 shrink-0">
                        <div className="absolute left-0 top-0 h-6 w-6 rounded-full border-2 border-[#1C1C1C] bg-[#1a2a4a] flex items-center justify-center text-white text-[9px] font-bold">
                          {asset.pool.token1[0]}
                        </div>
                        <div className="absolute left-3.5 top-0 h-6 w-6 rounded-full border-2 border-[#1C1C1C] bg-[#1a2a4a] flex items-center justify-center text-white text-[9px] font-bold">
                          {asset.pool.token2[0]}
                        </div>
                      </div>
                      <span className="text-white font-medium text-sm">
                        {asset.pool.token1}/{asset.pool.token2}
                      </span>
                      <span className="rounded-full bg-[#2F2F2F] px-2 py-0.5 text-xs font-semibold text-white/50">
                        {asset.pool.fee}
                      </span>
                    </div>
                  </td>

                  {/* ROI */}
                  <td className="px-4 py-3.5">
                    <span className="text-white text-sm font-medium">
                      {asset.roi}
                    </span>
                  </td>

                  {/* Fee APY */}
                  <td className="px-4 py-3.5">
                    <span className="text-white text-sm font-medium">
                      {asset.feeApy}
                    </span>
                  </td>

                  {/* Liquidity */}
                  <td className="px-4 py-3.5">
                    <span className="text-white text-sm font-medium">
                      {asset.liquidity}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AssetBreakdown;
