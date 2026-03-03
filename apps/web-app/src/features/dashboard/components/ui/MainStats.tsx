"use client";

import React from "react";
import Image from "next/image";
import { useWallet } from "@/hooks/useWallet";
import { parseBalance } from "@/features/dashboard/utils/dashboardUtils";
import { HoldingsPieChart } from "@/features/dashboard/components/HoldingsPieChart";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";
import { use24hPortfolioChange } from "@/hooks/use24hPortfolioChange";

const MainStats: React.FC = () => {
  const { balances, isFetchingBalances, address } = useWallet();
  const { assets: poolAssets, isLoading: isLoadingPools } = useDashboardPools();
  const {
    change: portfolioChange24h,
    isPositive: change24hPositive,
    isLoading: isLoading24h,
  } = use24hPortfolioChange(balances);

  // Get XLM balance for total value
  const xlmBalance = parseBalance(balances.xlm?.balance);

  // Convert balances to holdings format for chart
  const holdings = React.useMemo(() => {
    return Object.entries(balances)
      .filter(([, balance]) => {
        const balanceNum = parseBalance(balance.balance);
        return balanceNum > 0;
      })
      .map(([, balance]) => {
        const balanceNum = parseBalance(balance.balance);
        let assetName = "Unknown";

        if (balance.asset_type === "native") {
          assetName = "XLM";
        } else if (balance.asset_type === "liquidity_pool_shares") {
          assetName = "LP Shares";
        } else if (balance.asset_code) {
          assetName = balance.asset_code;
        }

        return {
          name: assetName,
          value: balanceNum,
        };
      })
      .sort((a, b) => b.value - a.value); // Sort by value descending
  }, [balances]);

  const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0);

  const avgPoolPerformance = React.useMemo(() => {
    if (isLoadingPools) return null;
    if (poolAssets.length === 0) return null;
    const total = poolAssets.reduce((sum, asset) => {
      return sum + parseFloat(asset.feeApy);
    }, 0);
    return (total / poolAssets.length).toFixed(2);
  }, [poolAssets, isLoadingPools]);

  return (
    <div className="w-full px-6 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Card: Portfolio Stats */}
        <div className="md:col-span-2 rounded-3xl bg-[#294cab] p-8 shadow-lg border border-[#334EAC]/90 relative overflow-hidden flex flex-col justify-between min-h-[320px]">
          {/* Neko Thumbs Up Background Image */}
          <Image
            src="/Neko_Thumbs_Up.png"
            alt="Neko Thumbs Up"
            fill
            className="object-contain opacity-30 pointer-events-none !w-auto !h-[340px] !left-auto !right-5 !bottom-3 !top-auto"
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-[#FFF9F0] tracking-wide">
                Portfolio
              </h2>
            </div>

            <div className="mb-8">
              <p className="text-[#7096D1] text-xs font-bold uppercase tracking-widest mb-2 opacity-80">
                Total Balance
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
                <p className="text-[#FFF9F0] font-bold text-lg mb-1">N/A</p>
                <p className="text-[#000000] text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Returns last week
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

          {/* Decorative background element */}
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-[#334EAC]/20 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Right Card: App Holdings Graph */}
        <div className="rounded-3xl bg-[#294cab] p-8 shadow-lg border border-[#334EAC]/50 relative overflow-hidden flex flex-col min-h-[320px]">
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#FFF9F0] tracking-wide">
                Wallet Holdings
              </h2>
              {isFetchingBalances && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#39bfb7] rounded-full animate-pulse"></div>
                  <span className="text-[#7096D1] text-xs">Updating...</span>
                </div>
              )}
            </div>
            {!address ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[#7096D1] text-sm text-center">
                  Connect your wallet to view holdings
                </p>
              </div>
            ) : holdings.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[#7096D1] text-sm mb-2">
                    No holdings found
                  </p>
                  <p className="text-[#7096D1] text-xs">
                    Fund your account to see balances here
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-[200px]">
                <HoldingsPieChart holdings={holdings} totalValue={totalValue} />
              </div>
            )}
          </div>
          {/* Decorative background element */}
          <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-[#334EAC]/10 rounded-full blur-2xl pointer-events-none"></div>
        </div>
      </div>
    </div>
  );
};

export default MainStats;
