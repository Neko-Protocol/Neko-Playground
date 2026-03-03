"use client";

import React from "react";
import Image from "next/image";
import { useWallet } from "@/hooks/useWallet";
import { usePortfolioValue } from "@/features/dashboard/hooks/usePortfolioValue";
import { HoldingsPieChart } from "@/features/dashboard/components/HoldingsPieChart";
import { useDashboardPools } from "@/features/dashboard/hooks/useDashboardPools";

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
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Card: Portfolio Stats */}
        <div className="md:col-span-2 rounded-3xl bg-neko-accent p-8 shadow-lg border border-[#334EAC]/90 relative overflow-hidden flex flex-col justify-between min-h-[320px]">
          <Image
            src="/Neko_Thumbs_Up.png"
            alt="Neko Thumbs Up"
            fill
            className="object-contain opacity-30 pointer-events-none w-auto! h-[340px]! left-auto! right-5! bottom-3! top-auto!"
          />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-bold text-[#FFF9F0] tracking-wide">
                Portfolio
              </h2>
            </div>

            <div className="mb-8">
              <p className="text-[#7096D1] text-xs font-bold uppercase tracking-widest mb-2 opacity-80">
                Total Portfolio Value
              </p>
              {!address ? (
                <h1 className="text-5xl font-bold text-[#FFF9F0] tracking-tight">
                  $0.00
                </h1>
              ) : isLoading ? (
                <div className="flex items-center gap-3">
                  <div className="h-12 w-48 rounded-xl bg-[#334EAC]/40 animate-pulse" />
                </div>
              ) : (
                <h1 className="text-5xl font-bold text-[#FFF9F0] tracking-tight">
                  {formatUsd(totalUsd)}
                </h1>
              )}
              <div className="flex items-center gap-2 mt-3">
                {isLoading && address && (
                  <div className="flex items-center bg-neko-teal/10 px-2 py-1 rounded-lg">
                    <div className="w-2 h-2 bg-neko-teal rounded-full animate-pulse mr-1" />
                    <span className="text-neko-teal font-bold text-sm">
                      Updating...
                    </span>
                  </div>
                )}
                {!isLoading && totalUsd === 0 && address && (
                  <span className="text-[#7096D1] text-sm font-medium">
                    No balances found
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#96b2ff]/90 rounded-2xl p-4 text-center border border-[#334EAC]/20 backdrop-blur-sm">
                <p className="text-[#FFF9F0] font-bold text-lg mb-1">
                  {holdings.length}
                </p>
                <p className="text-[#000000] text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Assets Held
                </p>
              </div>
              <div className="bg-[#96b2ff]/90 rounded-2xl p-4 text-center border border-[#334EAC]/20 backdrop-blur-sm">
                <p className="text-[#FFF9F0] font-bold text-lg mb-1">
                  {avgPoolApy !== null ? `${avgPoolApy}%` : "—"}
                </p>
                <p className="text-[#000000] text-[10px] font-bold uppercase tracking-wider opacity-70">
                  Avg. Pool APY
                </p>
              </div>
            </div>
          </div>

          <div className="absolute -right-10 -top-10 w-64 h-64 bg-[#334EAC]/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Right Card: Wallet Holdings Chart */}
        <div className="rounded-3xl bg-neko-accent p-8 shadow-lg border border-[#334EAC]/50 relative overflow-hidden flex flex-col min-h-[320px]">
          <div className="relative z-10 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[#FFF9F0] tracking-wide">
                Wallet Holdings
              </h2>
              {isLoading && (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-neko-teal rounded-full animate-pulse" />
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
            ) : chartHoldings.length === 0 ? (
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
                <HoldingsPieChart
                  holdings={chartHoldings}
                  totalValue={chartTotal}
                />
              </div>
            )}
          </div>
          <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-[#334EAC]/10 rounded-full blur-2xl pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default MainStats;
