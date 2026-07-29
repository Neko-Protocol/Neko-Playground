"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { CorrelationMatrix } from "../../types/analytics";

interface CorrelationHeatmapProps {
  data: CorrelationMatrix | undefined;
  isLoading?: boolean;
}

function correlationColor(value: number): string {
  if (value >= 0.7) return "bg-red-500/80 text-red-100";
  if (value >= 0.4) return "bg-orange-500/60 text-orange-100";
  if (value >= 0.1) return "bg-yellow-500/40 text-yellow-100";
  if (value >= -0.1) return "bg-white/10 text-white/60";
  if (value >= -0.4) return "bg-teal-500/40 text-teal-100";
  return "bg-teal-500/70 text-teal-100";
}

export function CorrelationHeatmap({
  data,
  isLoading,
}: CorrelationHeatmapProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 h-48 flex items-center justify-center">
        <p className="text-white/40 text-sm animate-pulse">
          Loading correlations…
        </p>
      </div>
    );
  }

  if (!data || data.assets.length === 0) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 h-48 flex items-center justify-center">
        <p className="text-white/30 text-sm">
          Insufficient data for correlation matrix
        </p>
      </div>
    );
  }

  const { assets, matrix } = data;
  const cellSize = Math.max(40, Math.min(64, Math.floor(320 / assets.length)));

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-white font-semibold text-sm">
            Correlation Matrix
          </h3>
          <span className="text-[10px] font-medium uppercase tracking-wide text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
            Modeled
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/30">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-teal-500/70" /> Negative
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded bg-red-500/80" /> Positive
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Column headers */}
          <div className="flex" style={{ marginLeft: cellSize + 8 }}>
            {assets.map((a) => (
              <div
                key={a}
                className="text-center text-xs text-white/40 font-medium flex-shrink-0 px-1"
                style={{ width: cellSize }}
              >
                {a}
              </div>
            ))}
          </div>

          {/* Rows */}
          {assets.map((rowAsset, i) => (
            <div key={rowAsset} className="flex items-center gap-2 mt-1">
              {/* Row label */}
              <div
                className="text-xs text-white/40 font-medium text-right flex-shrink-0"
                style={{ width: cellSize }}
              >
                {rowAsset}
              </div>

              {/* Cells */}
              {assets.map((_, j) => {
                const val = matrix[i]?.[j] ?? 0;
                return (
                  <div
                    key={j}
                    title={`${rowAsset} / ${assets[j]}: ${val.toFixed(2)}`}
                    className={cn(
                      "rounded text-xs font-mono flex items-center justify-center flex-shrink-0",
                      correlationColor(val)
                    )}
                    style={{ width: cellSize, height: cellSize - 8 }}
                  >
                    {val.toFixed(2)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
