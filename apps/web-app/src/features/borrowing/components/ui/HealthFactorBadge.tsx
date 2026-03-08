"use client";

import {
  getHealthFactorColor,
  getHealthFactorLabel,
} from "../../hooks/useHealthFactor";

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

  let bgBorder = "bg-white/5 border-white/10";
  let dotColor = "bg-white/20";

  if (healthFactor !== null) {
    if (healthFactor >= 1.5) {
      bgBorder = "bg-green-500/10 border-green-500/20";
      dotColor = "bg-green-400";
    } else if (healthFactor >= 1.0) {
      bgBorder = "bg-yellow-500/10 border-yellow-500/20";
      dotColor = "bg-yellow-400";
    } else {
      bgBorder = "bg-red-500/10 border-red-500/20";
      dotColor = "bg-red-400";
    }
  }

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
