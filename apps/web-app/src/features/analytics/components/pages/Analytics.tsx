"use client";

import React, { useState } from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { useWallet } from "@/hooks/useWallet";
import { DEFAULT_TIME_WINDOW } from "../../const/analytics";
import { useEarnings } from "../../hooks/useEarnings";
import { useNavHistory } from "../../hooks/useNavHistory";
import { usePortfolioMetrics } from "../../hooks/usePortfolioMetrics";
import { useRiskMetrics } from "../../hooks/useRiskMetrics";
import { SummaryCards } from "../ui/SummaryCards";
import { TimeWindowSelector } from "../ui/TimeWindowSelector";
import { NavChart } from "../ui/NavChart";
import { EarningsBreakdownTable } from "../ui/EarningsBreakdownTable";
import { AllocationDonut } from "../ui/AllocationDonut";
import { CorrelationHeatmap } from "../ui/CorrelationHeatmap";
import { RiskPanel } from "../ui/RiskPanel";
import { StressSimulator } from "../ui/StressSimulator";
import { YieldForecastPanel } from "../ui/YieldForecast";
import type { TimeWindow } from "../../types/analytics";

const Analytics: React.FC = () => {
  const { address } = useWallet();
  const [activeWindow, setActiveWindow] = useState<TimeWindow>(
    DEFAULT_TIME_WINDOW
  );

  const { data: earnings, isLoading: earningsLoading } =
    useEarnings(activeWindow);
  const { data: nav, isLoading: navLoading } = useNavHistory(activeWindow);
  const { data: metrics, isLoading: metricsLoading } = usePortfolioMetrics();
  const { data: risk, isLoading: riskLoading } = useRiskMetrics(activeWindow);

  const summaryLoading = earningsLoading || metricsLoading || riskLoading;

  if (!address) {
    return (
      <PageContainer maxWidth="7xl">
        <BannerPage
          title="Analytics"
          subtitle="Portfolio earnings, risk metrics and advanced DeFi analytics"
          badge="Deep insights"
          imageSrc="/banners/oracle.svg"
          imageAlt="Analytics illustration"
          className="mb-8"
        />
        <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-16 flex flex-col items-center justify-center gap-3">
          <p className="text-white/50 text-base font-medium">
            Connect your wallet to view analytics
          </p>
          <p className="text-white/25 text-sm">
            Your portfolio earnings, risk and allocation data will appear here
          </p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="7xl">
      <BannerPage
        title="Analytics"
        subtitle="Portfolio earnings, risk metrics and advanced DeFi analytics"
        badge="Deep insights"
        imageSrc="/banners/oracle.svg"
        imageAlt="Analytics illustration"
        className="mb-8"
      />

      {/* Time window + summary cards */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-white/60 text-sm font-medium">Portfolio Overview</h2>
        <TimeWindowSelector value={activeWindow} onChange={setActiveWindow} />
      </div>

      <div className="space-y-6">
        {/* Summary header cards */}
        <SummaryCards
          metrics={metrics}
          riskMetrics={risk}
          earnings={earnings}
          isLoading={summaryLoading}
        />

        {/* NAV history chart — full width */}
        <NavChart data={nav?.series ?? []} isLoading={navLoading} />

        {/* Earnings breakdown table */}
        <EarningsBreakdownTable
          data={earnings}
          isLoading={earningsLoading}
        />

        {/* Allocation + Correlation — side by side on wide screens */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AllocationDonut
            data={metrics?.allocationBySource ?? []}
            hhi={metrics?.hhi}
            diversificationScore={metrics?.diversificationScore}
            isLoading={metricsLoading}
          />
          <CorrelationHeatmap
            data={metrics?.correlationMatrix}
            isLoading={metricsLoading}
          />
        </div>

        {/* Risk panel + Stress simulator — side by side */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <RiskPanel data={risk} isLoading={riskLoading} />
          <StressSimulator
            riskMetrics={risk}
            totalValue={metrics?.totalValue ?? 0}
          />
        </div>

        {/* Yield forecast — full width */}
        <YieldForecastPanel
          data={metrics?.yieldForecast}
          isLoading={metricsLoading}
        />
      </div>
    </PageContainer>
  );
};

export default Analytics;
