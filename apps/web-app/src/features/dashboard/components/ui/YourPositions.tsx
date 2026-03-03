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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">Your Positions</h2>
        <Link
          href="/dashboard/pools"
          className="flex items-center gap-1 text-sm font-semibold text-neko-teal hover:text-neko-teal-light transition-colors"
        >
          Manage
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-6">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-neko-teal border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-white/40">
              Loading positions...
            </span>
          </div>
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-8 text-center">
          <Layers className="h-8 w-8 text-white/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-white mb-1">
            No active positions
          </p>
          <p className="text-xs text-white/40 mb-4">
            Deposit into a pool to start earning yield
          </p>
          <Link
            href="/dashboard/pools"
            className="inline-flex items-center gap-1 rounded-xl bg-neko-teal px-4 py-2 text-sm font-semibold text-white hover:bg-neko-teal/80 transition-colors"
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
              href={`/dashboard/pools/${encodeURIComponent(pool.id)}`}
              className="block rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 hover:border-white/10 hover:bg-[#222222] transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">
                    {pool.name}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {pool.tokens.map((t) => t.code).join(" / ")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">
                    {position.depositedFormatted}
                  </p>
                  {position.rewards > 0n && (
                    <p className="text-xs text-neko-teal font-semibold mt-0.5">
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
