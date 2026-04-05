"use client";

import React from "react";
import { useVaultInvest } from "../../hooks/useVaultInvest";

export function VaultOptimizeBanner() {
  const {
    idleAmount,
    canInvest,
    cooldownRemaining,
    isInvesting,
    lastResult,
    triggerInvest,
  } = useVaultInvest();

  if (idleAmount <= 0 && !lastResult) return null;

  return (
    <div className="mb-6 flex items-center justify-between rounded-xl border border-[#229EDF]/30 bg-[#229EDF]/10 px-5 py-3">
      <div>
        <p className="text-sm font-medium text-white">
          {idleAmount > 0 ? (
            <>
              <span className="text-[#229EDF]">
                {idleAmount.toFixed(4)} CETES
              </span>{" "}
              idle — not yet earning yield
            </>
          ) : (
            <span className="text-white/60">{lastResult}</span>
          )}
        </p>
        {lastResult && idleAmount > 0 && (
          <p className="mt-0.5 text-xs text-white/50">{lastResult}</p>
        )}
      </div>

      <button
        onClick={triggerInvest}
        disabled={isInvesting || (!canInvest && cooldownRemaining > 0)}
        className="ml-4 shrink-0 rounded-lg bg-[#229EDF] px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-[#1b8ac7] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isInvesting
          ? "Investing..."
          : cooldownRemaining > 0
            ? `Wait ${cooldownRemaining}s`
            : "Optimize Yield"}
      </button>
    </div>
  );
}
