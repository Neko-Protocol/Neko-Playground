"use client";

import React from "react";
import { TrendingUp } from "lucide-react";
import type { YieldForecast } from "../../types/analytics";

interface YieldForecastProps {
  data: YieldForecast | undefined;
  isLoading?: boolean;
}

const PERIODS = [
  { label: "30 Days", key: "days30" as const },
  { label: "90 Days", key: "days90" as const },
  { label: "365 Days", key: "days365" as const },
];

export function YieldForecastPanel({ data, isLoading }: YieldForecastProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6">
        <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-20 bg-white/5 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-4 w-4 text-[#68f9f2]" />
        <h3 className="text-white font-semibold text-sm">Yield Forecast</h3>
        {data?.blendedApy != null && (
          <span className="ml-auto text-xs text-white/30">
            @ {data.blendedApy.toFixed(2)}% blended APY
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {PERIODS.map(({ label, key }) => (
          <div
            key={key}
            className="rounded-xl bg-[#2A2A2A] p-4 flex flex-col gap-1"
          >
            <p className="text-xs text-white/40">{label}</p>
            <p className="text-lg font-bold text-white">
              {data?.[key] != null ? (
                <>
                  +$
                  {data[key].toLocaleString("en-US", {
                    maximumFractionDigits: 2,
                  })}
                </>
              ) : (
                <span className="text-white/30 text-base">—</span>
              )}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
