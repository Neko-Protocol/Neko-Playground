"use client";

import React, { useState, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RiskMetrics } from "../../types/analytics";

interface StressSimulatorProps {
  riskMetrics: RiskMetrics | null;
  totalValue: number;
}

export function StressSimulator({
  riskMetrics,
  totalValue,
}: StressSimulatorProps) {
  const [shockPct, setShockPct] = useState(-20);

  const scenario = useMemo(() => {
    const portfolioLoss = totalValue * (Math.abs(shockPct) / 100);
    const newValue = totalValue + (shockPct / 100) * totalValue;

    let newHealthFactor: number | null = null;
    let isLiquidated = false;

    if (riskMetrics?.healthFactor != null && totalValue > 0) {
      // Approximate: HF scales roughly with collateral value
      const scaleFactor = newValue / totalValue;
      newHealthFactor = riskMetrics.healthFactor * scaleFactor;
      isLiquidated = newHealthFactor < 1.0;
    }

    return { portfolioLoss, newValue, newHealthFactor, isLiquidated };
  }, [shockPct, totalValue, riskMetrics]);

  return (
    <div className="rounded-2xl border border-white/5 bg-[#1C1C1C] p-6 space-y-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-orange-400" />
        <h3 className="text-white font-semibold text-sm">
          Price Shock Stress Simulator
        </h3>
      </div>

      {/* Slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs text-white/40">
            Collateral price shock
          </label>
          <span
            className={cn(
              "text-sm font-bold",
              shockPct < 0 ? "text-red-400" : "text-green-400"
            )}
          >
            {shockPct > 0 ? "+" : ""}
            {shockPct}%
          </span>
        </div>
        <input
          type="range"
          min={-80}
          max={50}
          step={5}
          value={shockPct}
          onChange={(e) => setShockPct(Number(e.target.value))}
          className="w-full accent-[#68f9f2]"
        />
        <div className="flex justify-between text-xs text-white/25">
          <span>-80%</span>
          <span>0%</span>
          <span>+50%</span>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-[#2A2A2A] p-3 space-y-1">
          <p className="text-xs text-white/40">Portfolio Value</p>
          <p className="text-sm font-semibold text-white">
            $
            {scenario.newValue.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-xs text-red-400">
            -$
            {scenario.portfolioLoss.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        <div
          className={cn(
            "rounded-xl p-3 space-y-1",
            scenario.isLiquidated
              ? "bg-red-500/15 border border-red-500/30"
              : "bg-[#2A2A2A]"
          )}
        >
          <p className="text-xs text-white/40">Health Factor</p>
          {scenario.newHealthFactor !== null ? (
            <>
              <p
                className={cn(
                  "text-sm font-semibold",
                  scenario.isLiquidated ? "text-red-400" : "text-green-400"
                )}
              >
                {scenario.newHealthFactor.toFixed(2)}
              </p>
              {scenario.isLiquidated && (
                <p className="text-xs text-red-400 font-semibold">
                  ⚠ Would be liquidated
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-white/30">No borrow</p>
          )}
        </div>
      </div>
    </div>
  );
}
