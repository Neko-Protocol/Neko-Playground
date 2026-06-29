"use client";

import {
  AlertTriangle,
  ShieldCheck,
  TrendingDown,
  Activity,
} from "lucide-react";
import type { PositionSimulationResult } from "../../hooks/usePositionSimulation";
import {
  getHealthFactorColor,
  getHealthFactorLabel,
  getHealthFactorBadgeClasses,
} from "../../const/riskThresholds";

interface PositionPreviewPanelProps {
  simulation: PositionSimulationResult;
  currentHealthFactor?: number | null;
  collateralTokenCode: string;
  debtTokenCode: string;
}

export function PositionPreviewPanel({
  simulation,
  currentHealthFactor = null,
  collateralTokenCode,
  debtTokenCode,
}: PositionPreviewPanelProps) {
  const { projectedHealthFactor, liquidationPrice, warnings, isStale } =
    simulation;

  // Don't render if there's nothing to show.
  if (projectedHealthFactor === null && warnings.length === 0) {
    return null;
  }

  const projectedColor = getHealthFactorColor(projectedHealthFactor);
  const projectedLabel = getHealthFactorLabel(projectedHealthFactor);
  const { dotColor: projectedDot } = getHealthFactorBadgeClasses(
    projectedHealthFactor
  );

  const currentColor = getHealthFactorColor(currentHealthFactor);
  const currentLabel = getHealthFactorLabel(currentHealthFactor);

  const blockWarnings = warnings.filter((w) => w.severity === "block");
  const warnWarnings = warnings.filter((w) => w.severity === "warn");

  return (
    <div
      className={`mb-3 rounded-xl border p-3 transition-opacity duration-200 ${
        isStale ? "opacity-50" : "opacity-100"
      } ${
        blockWarnings.length > 0
          ? "bg-red-500/5 border-red-500/20"
          : warnWarnings.length > 0
            ? "bg-amber-500/5 border-amber-500/20"
            : "bg-white/5 border-white/10"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <Activity className="h-3.5 w-3.5 text-white/40" />
        <span className="text-white/50 text-xs font-medium uppercase tracking-wider">
          Position Preview
        </span>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        {/* Projected Health Factor */}
        <div className="rounded-lg bg-black/20 p-2.5">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
            Projected HF
          </p>
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${projectedDot}`} />
            <span
              className={`font-bold text-sm tabular-nums ${projectedColor}`}
            >
              {projectedHealthFactor !== null
                ? projectedHealthFactor.toFixed(2)
                : "—"}
            </span>
          </div>
          <span className={`text-[10px] opacity-70 ${projectedColor}`}>
            {projectedLabel}
          </span>
        </div>

        {/* Liquidation Price */}
        <div className="rounded-lg bg-black/20 p-2.5">
          <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
            Liq. Price
          </p>
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-3 w-3 text-white/30" />
            <span className="text-white font-bold text-sm tabular-nums">
              {liquidationPrice !== null ? liquidationPrice.toFixed(4) : "—"}
            </span>
          </div>
          <span className="text-white/30 text-[10px]">
            {collateralTokenCode}/{debtTokenCode}
          </span>
        </div>
      </div>

      {/* Risk transition */}
      {currentHealthFactor !== null && projectedHealthFactor !== null && (
        <div className="flex items-center gap-2 rounded-lg bg-black/20 px-2.5 py-2 mb-2">
          <ShieldCheck className="h-3.5 w-3.5 text-white/30 shrink-0" />
          <div className="flex items-center gap-1 text-xs">
            <span className={currentColor}>
              {currentHealthFactor.toFixed(2)}{" "}
              <span className="opacity-70">({currentLabel})</span>
            </span>
            <span className="text-white/20">→</span>
            <span className={projectedColor}>
              {projectedHealthFactor.toFixed(2)}{" "}
              <span className="opacity-70">({projectedLabel})</span>
            </span>
          </div>
        </div>
      )}

      {/* Block warnings */}
      {blockWarnings.map((w, i) => (
        <div
          key={`block-${i}`}
          className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 mb-1 last:mb-0"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-xs leading-relaxed">{w.message}</p>
        </div>
      ))}

      {/* Warn warnings */}
      {warnWarnings.map((w, i) => (
        <div
          key={`warn-${i}`}
          className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 mb-1 last:mb-0"
        >
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-400 text-xs leading-relaxed">{w.message}</p>
        </div>
      ))}
    </div>
  );
}
