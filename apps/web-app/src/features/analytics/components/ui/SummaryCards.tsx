"use client";

import React from "react";
import { DollarSign, TrendingUp, Zap, Shield } from "lucide-react";
import { StatCard } from "@/features/stocks/components/ui/StatCard";
import { cn } from "@/lib/utils";
import { RISK_SCORE_THRESHOLDS } from "../../const/analytics";
import type { PortfolioMetrics, RiskMetrics, EarningsData } from "../../types/analytics";

interface SummaryCardsProps {
  metrics: PortfolioMetrics | undefined;
  riskMetrics: RiskMetrics | null;
  earnings: EarningsData | undefined;
  isLoading: boolean;
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function riskLabel(score: number): string {
  if (score <= RISK_SCORE_THRESHOLDS.low) return "Low";
  if (score <= RISK_SCORE_THRESHOLDS.medium) return "Medium";
  return "High";
}

function riskColor(score: number): string {
  if (score <= RISK_SCORE_THRESHOLDS.low) return "text-green-400";
  if (score <= RISK_SCORE_THRESHOLDS.medium) return "text-yellow-400";
  return "text-red-400";
}

export function SummaryCards({
  metrics,
  riskMetrics,
  earnings,
  isLoading,
}: SummaryCardsProps) {
  const totalValue = metrics?.totalValue ?? 0;
  const totalEarned = earnings?.totalEarned ?? 0;
  const netApy = metrics?.netApy ?? 0;
  const riskScore = riskMetrics?.riskScore ?? 0;

  const earnedSign = totalEarned >= 0 ? "+" : "";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <StatCard
        icon={<DollarSign className="h-4 w-4" />}
        label="Total Portfolio Value"
        value={formatUsd(totalValue)}
        isLoading={isLoading}
      />
      <StatCard
        icon={<TrendingUp className="h-4 w-4" />}
        label="Total Earnings"
        value={
          <span
            className={cn(
              totalEarned >= 0 ? "text-green-400" : "text-red-400"
            )}
          >
            {earnedSign}
            {formatUsd(totalEarned)}
          </span>
        }
        isLoading={isLoading}
      />
      <StatCard
        icon={<Zap className="h-4 w-4" />}
        label="Net APY"
        value={
          <span className={cn(netApy >= 0 ? "text-green-400" : "text-red-400")}>
            {netApy >= 0 ? "+" : ""}
            {netApy.toFixed(2)}%
          </span>
        }
        isLoading={isLoading}
      />
      <StatCard
        icon={<Shield className="h-4 w-4" />}
        label="Risk Score"
        value={
          <span className={riskColor(riskScore)}>
            {riskScore}/100 — {riskLabel(riskScore)}
          </span>
        }
        isLoading={isLoading}
      />
    </div>
  );
}
