"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { useUserPositions } from "@/features/dashboard/hooks/useUserPositions";

const YourPositions: React.FC = () => {
  const { positions, isLoading, hasWallet } = useUserPositions();

  if (!hasWallet) return null;

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Your Positions
          </h2>
          <p className="text-white/40 text-sm">Active pool positions</p>
        </div>
        <Link
          href="/lending"
          className="flex items-center gap-1.5 text-sm font-semibold text-white/40 hover:text-white transition-colors"
        >
          Manage
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-10 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white/60" />
          <span className="text-white/40 text-sm">Loading positions...</span>
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-10 text-center">
          <Layers className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-white font-semibold text-sm mb-1">
            No active positions
          </p>
          <p className="text-white/40 text-xs mb-5">
            Deposit into a pool to start earning yield
          </p>
          <Link
            href="/pools"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#2A2A2A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333] transition-colors"
          >
            Explore Pools
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map(({ pool, position }) => (
            <Link
              key={pool.id}
              href={`/pools/${encodeURIComponent(pool.id)}`}
              className="block rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 hover:border-white/10 hover:bg-[#222222] transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold text-sm">
                    {pool.name}
                  </p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {pool.tokens.map((t) => t.code).join(" / ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold text-sm">
                    {position.depositedFormatted}
                  </p>
                  {position.rewards > 0n && (
                    <p className="text-[#76C464] text-xs font-semibold mt-0.5">
                      +{position.rewardsFormatted} rewards
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default YourPositions;
