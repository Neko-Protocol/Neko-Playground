"use client";

import {
  getHealthFactorColor,
  getHealthFactorLabel,
  getHealthFactorBadgeClasses,
} from "../../const/riskThresholds";

interface HealthFactorBadgeProps {
  healthFactor: number | null;
  isLoading?: boolean;
}

export function HealthFactorBadge({
  healthFactor,
  isLoading = false,
}: HealthFactorBadgeProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5">
        <div className="h-2 w-2 rounded-full bg-white/20 animate-pulse" />
        <span className="text-white/40 text-sm font-bold">—</span>
      </div>
    );
  }

  const color = getHealthFactorColor(healthFactor);
  const label = getHealthFactorLabel(healthFactor);
  const { bgBorder, dotColor } = getHealthFactorBadgeClasses(healthFactor);

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${bgBorder}`}
    >
      <div className={`h-2 w-2 rounded-full ${dotColor}`} />
      <span className={`font-bold text-sm ${color}`}>
        {healthFactor !== null ? healthFactor.toFixed(2) : "—"}
      </span>
      <span className={`text-xs opacity-70 ${color}`}>{label}</span>
    </div>
  );
}
