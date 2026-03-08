"use client";

import { TrendingUp, Shield, Banknote, LayoutGrid } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useUserPosition } from "../../hooks/useUserPosition";
import { TokenAvatar } from "./TokenAvatar";
import { HealthFactorBadge } from "./HealthFactorBadge";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-white/30 text-[10px] font-semibold uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="text-white/20 text-xs py-2">{message}</p>;
}

function Skeleton() {
  return (
    <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 animate-pulse space-y-4">
      <div className="h-3 w-32 bg-white/10 rounded" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-14 bg-white/5 rounded-xl" />
        ))}
      </div>
      <div className="h-20 bg-white/5 rounded-xl" />
    </div>
  );
}

export function UserPositionCard() {
  const { address } = useWallet();
  const {
    deposits,
    debts,
    healthFactors,
    collateral,
    borrowLimits,
    isLoading,
    hasWallet,
  } = useUserPosition(address ?? undefined);

  if (!hasWallet) return null;
  if (isLoading) return <Skeleton />;

  const hasAnyPosition =
    deposits.length > 0 || debts.length > 0 || collateral.length > 0;

  return (
    <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 mb-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-[#229EDF]/15 flex items-center justify-center flex-shrink-0">
          <LayoutGrid className="h-4 w-4 text-[#229EDF]" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-none">
            Position Overview
          </p>
          <p className="text-white/30 text-xs mt-0.5">
            Your deposits, collateral, and borrow capacity
          </p>
        </div>
      </div>

      {!hasAnyPosition ? (
        <div className="py-6 text-center">
          <p className="text-white/30 text-sm">No open positions yet.</p>
          <p className="text-white/20 text-xs mt-1">
            Deposit assets or add collateral to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Deposits */}
          <div className="rounded-xl bg-[#242424] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 mb-3">
              <TrendingUp className="h-3.5 w-3.5 text-[#229EDF]" />
              <SectionLabel>Deposits</SectionLabel>
            </div>
            {deposits.length === 0 ? (
              <EmptyRow message="No deposits" />
            ) : (
              deposits.map((d) => (
                <div
                  key={d.assetCode}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <TokenAvatar code={d.assetCode} />
                    <span className="text-white/60 text-xs">{d.assetCode}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-xs font-semibold tabular-nums">
                      {parseFloat(d.depositedFormatted).toLocaleString(
                        "en-US",
                        {
                          maximumFractionDigits: 4,
                        }
                      )}
                    </p>
                    <p className="text-green-400 text-[10px]">
                      +{d.interestRate.toFixed(2)}%
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Collateral */}
          <div className="rounded-xl bg-[#242424] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 mb-3">
              <Shield className="h-3.5 w-3.5 text-[#229EDF]" />
              <SectionLabel>Collateral</SectionLabel>
            </div>
            {collateral.length === 0 ? (
              <EmptyRow message="No collateral posted" />
            ) : (
              collateral.map((c) => (
                <div
                  key={c.tokenCode}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <TokenAvatar code={c.tokenCode} />
                    <span className="text-white/60 text-xs">{c.tokenCode}</span>
                  </div>
                  <p className="text-white text-xs font-semibold tabular-nums">
                    {parseFloat(c.formatted).toLocaleString("en-US", {
                      maximumFractionDigits: 4,
                    })}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* Borrow capacity + health */}
          <div className="rounded-xl bg-[#242424] p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 mb-3">
              <Banknote className="h-3.5 w-3.5 text-[#229EDF]" />
              <SectionLabel>Borrow Capacity</SectionLabel>
            </div>
            {borrowLimits.map((bl) => {
              const hf = healthFactors.find((h) => h.key === bl.key) ?? null;
              return (
                <div key={bl.key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-white/40 text-xs">{bl.label}</span>
                    <span className="text-white text-xs font-semibold tabular-nums">
                      {bl.limitUsd !== null
                        ? `$${bl.limitUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
                        : "—"}
                    </span>
                  </div>
                  {hf && (
                    <div className="flex items-center justify-between">
                      <span className="text-white/25 text-[10px]">
                        Health factor
                      </span>
                      <HealthFactorBadge healthFactor={hf.healthFactor} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
