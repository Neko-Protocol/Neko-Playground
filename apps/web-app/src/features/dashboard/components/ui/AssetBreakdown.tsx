"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Droplets, Layers, Info } from "lucide-react";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";

function typeLabel(type: string): string {
  if (type === "blend" || type === "neko") return "Lending";
  if (type === "soroswap") return "AMM";
  return type;
}

function ColHeader({
  icon: Icon,
  label,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  tooltip?: string;
}) {
  return (
    <th className="px-4 py-3 text-left">
      <div className="flex items-center gap-1.5 text-white/40 text-xs font-semibold uppercase tracking-wide">
        <Icon className="h-3.5 w-3.5" />
        {label}
        {tooltip && (
          <span className="group relative cursor-help">
            <Info className="h-3 w-3 text-white/20" />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 whitespace-nowrap rounded-lg bg-[#2A2A2A] px-2.5 py-1 text-[10px] font-normal normal-case tracking-normal text-white/70 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {tooltip}
            </span>
          </span>
        )}
      </div>
    </th>
  );
}

const AssetBreakdown: React.FC = () => {
  const router = useRouter();
  const { assets, isLoading, error } = useDashboardPools();

  return (
    <div className="w-full px-3 pt-6">
      <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <ColHeader icon={Layers} label="Pool" />
              <ColHeader
                icon={TrendingUp}
                label="ROI"
                tooltip="Return on Investment"
              />
              <ColHeader
                icon={TrendingUp}
                label="Fee APY"
                tooltip="Annual Percentage Yield from fees"
              />
              <ColHeader
                icon={Droplets}
                label="Liquidity"
                tooltip="Total liquidity in pool"
              />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  Loading pools...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-red-400 text-sm"
                >
                  Error loading pools: {String(error)}
                </td>
              </tr>
            ) : assets.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  No pools available
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="border-b border-white/5 hover:bg-white/2 transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {/* Token pair avatars */}
                      <div className="relative w-10 h-6 shrink-0">
                        <div className="absolute left-0 w-6 h-6 rounded-full bg-[#229EDF] border-2 border-[#1C1C1C] flex items-center justify-center text-white text-[10px] font-bold">
                          {asset.pool.token1[0]}
                        </div>
                        <div className="absolute left-4 w-6 h-6 rounded-full bg-[#229EDF]/60 border-2 border-[#1C1C1C] flex items-center justify-center text-white text-[10px] font-bold">
                          {asset.pool.token2[0]}
                        </div>
                      </div>
                      <div>
                        <span className="text-white font-medium text-sm">
                          {asset.pool.token1} / {asset.pool.token2}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50">
                            {typeLabel(asset.type)}
                          </span>
                          <div className="flex items-center gap-1">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${
                                asset.isActive ? "bg-green-400" : "bg-gray-500"
                              }`}
                            />
                            <span className="text-[10px] text-white/30">
                              {asset.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-white text-sm">{asset.roi}</td>
                  <td className="px-4 py-4 text-white text-sm">
                    {asset.feeApy}
                  </td>
                  <td className="px-4 py-4 text-white text-sm">
                    {asset.liquidity}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center mt-5">
        <button
          onClick={() => router.push("/dashboard/pools")}
          className="rounded-xl bg-[#229EDF] hover:bg-[#1a8bc7] px-6 py-2.5 text-white text-sm font-semibold transition-colors"
        >
          Checkout all Pools
        </button>
      </div>
    </div>
  );
};

export default AssetBreakdown;
