"use client";

import React from "react";
import { TrendingDown, Coins, Activity } from "lucide-react";
import { useUserBorrowPositions } from "../../hooks/useUserBorrowPositions";
import type { BorrowPosition } from "../../hooks/useUserBorrowPositions";

const SCALAR_12 = 1_000_000_000_000n;

function formatDRate(dRate: bigint): string {
  if (dRate === 0n) return "—";
  // dRate has 12 decimals; show as a readable number (e.g. 1.000012)
  const whole = dRate / SCALAR_12;
  const frac = dRate % SCALAR_12;
  const fracStr = frac.toString().padStart(12, "0").slice(0, 6);
  return `${whole}.${fracStr}`;
}

function PositionCard({ position }: { position: BorrowPosition }) {
  return (
    <div className="flex-shrink-0 w-72 sm:w-80 rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-full bg-[#229EDF]/15 flex items-center justify-center">
            <Coins className="h-4 w-4 text-[#229EDF]" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-none">
              {position.assetCode}
            </p>
            <p className="text-white/40 text-xs mt-0.5">
              Collateral: {position.collateralTokenCode}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#229EDF]/10 text-[#229EDF]">
          Active
        </span>
      </div>

      {/* Debt */}
      <div className="rounded-xl bg-[#242424] p-3">
        <p className="text-white/40 text-xs mb-1">Current Debt</p>
        <p className="text-white font-bold text-2xl leading-none">
          {position.debtFormatted}
          <span className="text-white/40 text-sm font-normal ml-1.5">
            {position.assetCode}
          </span>
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[#242424] px-3 py-2.5">
          <div className="flex items-center gap-1 text-white/40 mb-1">
            <TrendingDown className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              APR
            </span>
          </div>
          <p className="text-white text-sm font-semibold">
            {position.interestRate.toFixed(2)}%
          </p>
        </div>

        <div className="rounded-xl bg-[#242424] px-3 py-2.5">
          <div className="flex items-center gap-1 text-white/40 mb-1">
            <Activity className="h-3 w-3" />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              dToken Rate
            </span>
          </div>
          <p className="text-white text-sm font-semibold font-mono">
            {formatDRate(position.dRate)}
          </p>
        </div>
      </div>

      {/* dToken balance */}
      <div className="flex items-center justify-between border-t border-white/5 pt-3">
        <p className="text-white/30 text-xs">dToken Balance</p>
        <p className="text-white/60 text-xs font-mono">
          {position.dTokens.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function CurrentPositions() {
  const { positions, isLoading, hasWallet } = useUserBorrowPositions();

  if (!hasWallet) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-white font-bold text-lg leading-none">
            Current Positions
          </h2>
          <p className="text-white/40 text-xs mt-1">
            Your active borrow positions and accrued debt
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 px-6 py-8 flex items-center gap-3">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white/60 flex-shrink-0" />
          <span className="text-white/40 text-sm">
            Loading borrow positions…
          </span>
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 px-6 py-8 flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
            <TrendingDown className="h-5 w-5 text-white/20" />
          </div>
          <div>
            <p className="text-white/60 text-sm font-medium">
              No active borrow positions
            </p>
            <p className="text-white/30 text-xs mt-0.5">
              Select a pool below to start borrowing
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
          {positions.map((pos) => (
            <PositionCard key={pos.assetCode} position={pos} />
          ))}
        </div>
      )}
    </div>
  );
}
