"use client";

import React from "react";
import dynamic from "next/dynamic";
import { DollarSign, Coins, TrendingUp } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioValue } from "@/features/dashboard/hooks/usePortfolioValue";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";
import { useUnifiedPositions } from "@/features/dashboard/hooks/useUnifiedPositions";
import { StatCard } from "@/features/stocks/components/ui/StatCard";

// Chart.js is heavy and only needed here — load it in its own chunk,
// client-side only, with a skeleton while it streams in.
const HoldingsPieChart = dynamic(
  () =>
    import("@/features/dashboard/components/HoldingsPieChart").then(
      (m) => m.HoldingsPieChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[220px] animate-pulse rounded-xl bg-white/5" />
    ),
  }
);

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MainStats: React.FC = () => {
  const { address, isFetchingBalances } = useWallet();
  const { holdings, isLoading: isLoadingPortfolio } = usePortfolioValue();
  const { assets } = useDashboardPools();
  const {
    totalValueUsd,
    unpricedPositionCount,
    isLoading: isLoadingUnified,
  } = useUnifiedPositions();

  const avgPoolApy = React.useMemo(() => {
    if (assets.length === 0) return null;
    const sum = assets.reduce((acc, a) => {
      const parsed = parseFloat(a.roi.replace("%", ""));
      return acc + (Number.isFinite(parsed) ? parsed : 0);
    }, 0);
    return (sum / assets.length).toFixed(1);
  }, [assets]);

  const chartHoldings = React.useMemo(
    () =>
      holdings.map((h) => ({
        name: h.code,
        value: h.valueUsd > 0 ? h.valueUsd : h.balance,
      })),
    [holdings]
  );

  const chartTotal = chartHoldings.reduce((sum, h) => sum + h.value, 0);
  const isLoading = isFetchingBalances || isLoadingPortfolio;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Portfolio Value"
          value={
            address ? (
              <>
                {formatUsd(totalValueUsd)}
                {unpricedPositionCount > 0 && (
                  <span
                    className="ml-1.5 align-middle text-[10px] font-normal text-white/30"
                    title="Some positions (e.g. AMM liquidity) don't have a reliable USD price yet and aren't included in this total."
                  >
                    +{unpricedPositionCount} unpriced
                  </span>
                )}
              </>
            ) : (
              "$0.00"
            )
          }
          isLoading={(isLoading || isLoadingUnified) && !!address}
        />
        <StatCard
          icon={<Coins className="h-5 w-5" />}
          label="Assets Held"
          value={address ? holdings.length : 0}
          isLoading={isLoading && !!address}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Avg. Pool APY"
          value={avgPoolApy !== null ? `${avgPoolApy}%` : "—"}
        />
      </div>

      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 sm:p-6">
        <h3 className="text-white font-semibold text-sm mb-4">
          Wallet Holdings
        </h3>
        {!address ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-white/40 text-sm">
              Connect your wallet to view holdings
            </p>
          </div>
        ) : chartHoldings.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <p className="text-white/40 text-sm mb-1">No holdings found</p>
              <p className="text-white/30 text-xs">
                Fund your account to see balances here
              </p>
            </div>
          </div>
        ) : (
          <div className="min-h-[220px]">
            <HoldingsPieChart
              holdings={chartHoldings}
              totalValue={chartTotal}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MainStats;
