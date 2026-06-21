"use client";

import { usePortfolioAnalytics } from "../hooks/usePortfolioAnalytics";
import type { YieldBreakdown, RiskExposure } from "../types";

interface AnalyticsDashboardProps {
  walletAddress?: string;
}

export default function AnalyticsDashboard({ walletAddress }: AnalyticsDashboardProps) {
  const { summary, yieldBreakdown, riskExposure, performanceHistory, filters, setFilter } = usePortfolioAnalytics();

  return (
    <div className="space-y-6" role="region" aria-label="Portfolio Analytics">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.timeRange}
          onChange={(e) => setFilter("timeRange", e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm"
          aria-label="Time range"
        >
          <option value="7d">7 Days</option>
          <option value="30d">30 Days</option>
          <option value="90d">90 Days</option>
          <option value="all">All Time</option>
        </select>
        <select
          value={filters.chain}
          onChange={(e) => setFilter("chain", e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm"
          aria-label="Chain filter"
        >
          <option value="all">All Chains</option>
          <option value="stellar">Stellar</option>
          <option value="ethereum">Ethereum</option>
          <option value="solana">Solana</option>
        </select>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Value" value={"$" + summary.totalValueUsd.toLocaleString()} />
        <SummaryCard label="Yield Earned" value={"$" + summary.totalYieldEarned.toLocaleString()} accent="green" />
        <SummaryCard label="Avg APY" value={summary.averageApy.toFixed(2) + "%"} accent="purple" />
        <SummaryCard label="Positions" value={String(summary.positionsCount)} />
      </div>

      {/* Best/Worst Performers */}
      {(summary.bestPerforming || summary.worstPerforming) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.bestPerforming && (
            <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5">
              <p className="text-xs text-green-400 uppercase tracking-wider">Best Performer</p>
              <p className="font-medium mt-1">{summary.bestPerforming.protocol}/{summary.bestPerforming.poolId}</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{summary.bestPerforming.apy.toFixed(2)}% APY</p>
            </div>
          )}
          {summary.worstPerforming && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
              <p className="text-xs text-red-400 uppercase tracking-wider">Lowest Yield</p>
              <p className="font-medium mt-1">{summary.worstPerforming.protocol}/{summary.worstPerforming.poolId}</p>
              <p className="text-2xl font-bold text-red-400 mt-1">{summary.worstPerforming.apy.toFixed(2)}% APY</p>
            </div>
          )}
        </div>
      )}

      {/* Yield Breakdown */}
      {yieldBreakdown.length > 0 && (
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/30">
          <h3 className="font-medium mb-3">Yield by Protocol</h3>
          <div className="space-y-2">
            {yieldBreakdown.map((item: YieldBreakdown) => (
              <div key={item.protocol} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm flex-1">{item.protocol}</span>
                <span className="text-sm text-gray-400">${item.valueUsd.toLocaleString()}</span>
                <span className="text-sm font-medium">{item.percentage.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risk Exposure */}
      {riskExposure.length > 0 && (
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/30">
          <h3 className="font-medium mb-3">Risk Exposure</h3>
          <div className="space-y-2">
            {riskExposure.map((item: RiskExposure) => (
              <div key={item.protocol} className="flex items-center gap-3">
                <span className={"text-xs px-2 py-0.5 rounded-full " + (
                  item.riskLevel === "low" ? "bg-green-500/20 text-green-400" :
                  item.riskLevel === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-red-500/20 text-red-400"
                )}>
                  {item.riskLevel}
                </span>
                <span className="text-sm flex-1">{item.protocol}</span>
                <span className="text-sm text-gray-400">{item.concentration.toFixed(1)}% concentration</span>
                <span className="text-sm">Score: {item.riskScore.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Chart Placeholder */}
      {performanceHistory.length > 0 && (
        <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/30">
          <h3 className="font-medium mb-3">Performance Trend</h3>
          <div className="h-48 flex items-end gap-1">
            {performanceHistory.slice(-30).map((point: { date: number; totalValue: number; yieldEarned: number; apy: number }, i: number) => {
              const maxVal = Math.max(...performanceHistory.map((p: { totalValue: number }) => p.totalValue)) || 1;
              const height = (point.totalValue / maxVal) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 bg-indigo-500/60 rounded-t hover:bg-indigo-400 transition-colors"
                  style={{ height: height + "%", minHeight: "2px" }}
                  title={"$" + point.totalValue.toLocaleString() + " | " + point.apy.toFixed(2) + "% APY"}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{performanceHistory.length > 0 ? new Date(performanceHistory[0].date).toLocaleDateString() : "N/A"}</span>
            <span>{performanceHistory.length > 0 ? new Date(performanceHistory[performanceHistory.length - 1].date).toLocaleDateString() : "N/A"}</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {summary.positionsCount === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No positions yet</p>
          <p className="text-sm mt-1">Start depositing into vaults and pools to see your analytics</p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: "green" | "purple" }) {
  const colorClass = accent === "green" ? "text-green-400" : accent === "purple" ? "text-purple-400" : "";
  return (
    <div className="p-4 rounded-xl border border-gray-700 bg-gray-800/30">
      <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={"text-xl font-bold mt-1 " + colorClass}>{value}</p>
    </div>
  );
}
