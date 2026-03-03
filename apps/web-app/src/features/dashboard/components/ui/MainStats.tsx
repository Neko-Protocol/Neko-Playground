"use client";

import React from "react";
import { DollarSign, Coins, TrendingUp } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioValue } from "@/features/dashboard/hooks/usePortfolioValue";
import { HoldingsPieChart } from "@/features/dashboard/components/HoldingsPieChart";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";
import { StatCard } from "@/features/stocks/components/ui/StatCard";

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const MainStats: React.FC = () => {
  const { isFetchingBalances, address } = useWallet();
  const { totalUsd, holdings, isLoading: isLoadingPortfolio } =
    usePortfolioValue();
  const { assets } = useDashboardPools();

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
    <div className="space-y-5">
      {/* Stats row — reuses StatCard from stocks feature */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <StatCard
          icon={<DollarSign className="h-5 w-5" />}
          label="Total Portfolio Value"
          value={address ? formatUsd(totalUsd) : "$0.00"}
          isLoading={isLoading && !!address}
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

      {/* Wallet holdings chart */}
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-6">
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
