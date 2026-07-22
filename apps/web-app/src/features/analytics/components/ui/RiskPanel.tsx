"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  getHealthFactorColor,
  getHealthFactorLabel,
} from "@/features/borrowing/hooks/useHealthFactor";
import type { RiskMetrics } from "../../types/analytics";

interface RiskPanelProps {
  data: RiskMetrics | null;
  isLoading?: boolean;
}

interface MetricRowProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
}

function MetricRow({ label, value, sub }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
      <div>
        <p className="text-xs text-white/40 font-medium">{label}</p>
        {sub && <p className="text-xs text-white/25 mt-0.5">{sub}</p>}
      </div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function formatRatio(v: number | null): React.ReactNode {
  if (v === null) return <span className="text-white/30">—</span>;
  const color =
    v >= 1 ? "text-green-400" : v >= 0 ? "text-yellow-400" : "text-red-400";
  return <span className={color}>{v.toFixed(2)}</span>;
}

export function RiskPanel({ data, isLoading }: RiskPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 space-y-3">
        <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6">
      <h3 className="text-white font-semibold text-sm mb-4">Risk Metrics</h3>

      <MetricRow
        label="Sharpe Ratio"
        sub="Annualised, rf = 5% · needs 2+ days of history"
        value={formatRatio(data?.sharpe ?? null)}
      />
      <MetricRow
        label="Sortino Ratio"
        sub="Downside deviation · needs 2+ days of history"
        value={formatRatio(data?.sortino ?? null)}
      />
      <MetricRow
        label="Max Drawdown"
        sub={data?.maxDrawdownDate ?? "—"}
        value={
          data?.maxDrawdown != null ? (
            <span className="text-red-400">
              -{data.maxDrawdown.toFixed(2)}%
            </span>
          ) : (
            <span className="text-white/30">—</span>
          )
        }
      />
      <MetricRow
        label="Current Drawdown"
        value={
          data?.currentDrawdown != null ? (
            <span
              className={cn(
                data.currentDrawdown < -0.5 ? "text-red-400" : "text-green-400"
              )}
            >
              {data.currentDrawdown.toFixed(2)}%
            </span>
          ) : (
            <span className="text-white/30">—</span>
          )
        }
      />
      <MetricRow
        label="Health Factor"
        sub="Live · lowest across pools"
        value={
          <span className={getHealthFactorColor(data?.healthFactor ?? null)}>
            {data?.healthFactor != null
              ? `${data.healthFactor.toFixed(2)} — ${getHealthFactorLabel(data.healthFactor)}`
              : "No borrow position"}
          </span>
        }
      />
      {data?.distanceToLiquidation != null && (
        <MetricRow
          label="Distance to Liquidation"
          sub="Collateral price drop that triggers"
          value={
            <span className="text-orange-400">
              -{data.distanceToLiquidation.toFixed(1)}%
            </span>
          }
        />
      )}
    </div>
  );
}
