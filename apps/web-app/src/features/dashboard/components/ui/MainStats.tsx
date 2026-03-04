"use client";

import React from "react";
import { DollarSign, Coins, TrendingUp } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioValue } from "@/features/dashboard/hooks/usePortfolioValue";
import { HoldingsPieChart } from "@/features/dashboard/components/HoldingsPieChart";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";
import { use24hPortfolioChange } from "@/hooks/use24hPortfolioChange";
import { useUserTotalDeposited } from "@/hooks/useUserTotalDeposited";

const MainStats: React.FC = () => {
  const { balances, isFetchingBalances, address } = useWallet();
  const { assets: poolAssets, isLoading: isLoadingPools } = useDashboardPools();
  const { data: totalDepositedData, isLoading: isLoadingDeposited } =
    useUserTotalDeposited(address);
  const {
    change: portfolioChange24h,
    isPositive: change24hPositive,
    isLoading: isLoading24h,
  } = use24hPortfolioChange(balances);

  // Get XLM balance for total value
  const xlmBalance = parseBalance(balances.xlm?.balance);

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

  const avgPoolPerformance = React.useMemo(() => {
    if (isLoadingPools) return null;
    if (poolAssets.length === 0) return null;
    const total = poolAssets.reduce((sum, asset) => {
      return sum + parseFloat(asset.feeApy);
    }, 0);
    return (total / poolAssets.length).toFixed(2);
  }, [poolAssets, isLoadingPools]);

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
              <h1 className="text-5xl font-bold text-[#FFF9F0] tracking-tight">
                {xlmBalance > 0 ? (
                  <>
                    {balances.xlm?.balance ?? "0"}{" "}
                    <span className="text-2xl text-[#7096D1]">XLM</span>
                  </>
                ) : (
                  "$0.00"
                )}
              </h1>
              <div className="flex items-center gap-2 mt-3">
                {isFetchingBalances && (
                  <div className="flex items-center bg-[#39bfb7]/10 px-2 py-1 rounded-lg">
                    <div className="w-2 h-2 bg-[#39bfb7] rounded-full animate-pulse mr-1"></div>
                    <span className="text-[#39bfb7] font-bold text-sm">
                      Updating...
                    </span>
                  </div>
                )}
                {!isFetchingBalances && totalValue === 0 && address && (
                  <span className="text-[#7096D1] text-sm font-medium">
                    No balances found
                  </span>
                )}
                {!isFetchingBalances && totalValue > 0 && (
                  <div className="flex items-center bg-[#39bfb7]/10 px-2 py-1 rounded-lg">
                    {isLoading24h ? (
                      <div className="w-2 h-2 bg-[#39bfb7] rounded-full animate-pulse mr-1" />
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 mr-1 ${change24hPositive === false ? "rotate-180 text-red-400" : "text-[#39bfb7]"}`}
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <span
                      className={`font-bold text-sm ${change24hPositive === false ? "text-red-400" : "text-[#39bfb7]"}`}
                    >
                      {isLoading24h ? "..." : (portfolioChange24h ?? "N/A")}
                    </span>
                  </div>
                )}
                {!isFetchingBalances && totalValue > 0 && (
                  <span className="text-[#7096D1] text-sm font-medium">
                    past 24h
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#96b2ff]/90 rounded-2xl p-4 text-center border border-[#334EAC]/20 backdrop-blur-sm">
                <p className="text-[#FFF9F0] font-bold text-lg mb-1">
                  {!address
                    ? "N/A"
                    : isLoadingDeposited
                      ? "..."
                      : totalDepositedData && totalDepositedData.totalUsd > 0
                        ? `$${totalDepositedData.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : "$0.00"}
                </p>
                <p className="text-[#000000] text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Total Deposited
                </p>
              </div>
              <div className="bg-[#96b2ff]/90 rounded-2xl p-4 text-center border border-[#334EAC]/20 backdrop-blur-sm">
                <p className="text-[#FFF9F0] font-bold text-lg mb-1">
                  {isLoadingPools
                    ? "..."
                    : avgPoolPerformance !== null
                      ? `${avgPoolPerformance}%`
                      : "N/A"}
                </p>
                <p className="text-[#000000] text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Avg. Pool Performance
                </p>
              </div>
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
