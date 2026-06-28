"use client";

import React from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { SOURCE_LABELS, SOURCE_COLORS } from "../../const/analytics";
import type { EarningsData, EarningsByAsset } from "../../types/analytics";

interface EarningsBreakdownTableProps {
  data: EarningsData | undefined;
  isLoading?: boolean;
}

function exportCsv(byAsset: EarningsByAsset[]) {
  const header = "Asset,Source,Earned (USD)\n";
  const rows = byAsset
    .map((r) => `${r.asset},${SOURCE_LABELS[r.source]},${r.earned.toFixed(6)}`)
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "earnings_breakdown.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function EarningsBreakdownTable({
  data,
  isLoading,
}: EarningsBreakdownTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="animate-pulse h-10 rounded-lg bg-white/5"
          />
        ))}
      </div>
    );
  }

  const sources = data?.sources ?? [];
  const byAsset = data?.byAsset ?? [];

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">
          Earnings Breakdown
        </h3>
        <button
          onClick={() => exportCsv(byAsset)}
          disabled={byAsset.length === 0}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors disabled:opacity-30"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </button>
      </div>

      {/* Per-source summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sources.map((s) => (
          <div
            key={s.id}
            className="rounded-xl bg-[#2A2A2A] p-3 flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: SOURCE_COLORS[s.id] }}
              />
              <p className="text-xs text-white/40">{SOURCE_LABELS[s.id]}</p>
            </div>
            <p className="text-sm font-semibold text-white">
              {s.earned >= 0 ? "+" : ""}${s.earned.toFixed(2)}
            </p>
            <p
              className={cn(
                "text-xs",
                s.earnedPct >= 0 ? "text-green-400" : "text-red-400"
              )}
            >
              {s.earnedPct >= 0 ? "+" : ""}
              {s.earnedPct.toFixed(2)}%
            </p>
          </div>
        ))}
      </div>

      {/* Per-asset table */}
      {byAsset.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-white/30 text-xs border-b border-white/5">
                <th className="text-left py-2 pr-4 font-medium">Asset</th>
                <th className="text-left py-2 pr-4 font-medium">Source</th>
                <th className="text-right py-2 font-medium">Earned (USD)</th>
              </tr>
            </thead>
            <tbody>
              {byAsset.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 pr-4 text-white font-medium">
                    {row.asset}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                      style={{
                        background: SOURCE_COLORS[row.source] + "20",
                        color: SOURCE_COLORS[row.source],
                      }}
                    >
                      {SOURCE_LABELS[row.source]}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "py-3 text-right font-mono text-xs",
                      row.earned >= 0 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {row.earned >= 0 ? "+" : ""}${row.earned.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {byAsset.length === 0 && !isLoading && (
        <p className="text-center text-white/30 text-sm py-6">
          No earnings data for this window
        </p>
      )}
    </div>
  );
}
