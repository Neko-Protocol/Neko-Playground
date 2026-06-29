"use client";

import React from "react";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AllocationDiff } from "./AllocationDiff";
import type { SimulationResult } from "../../types/automation";

interface Props {
  result: SimulationResult | undefined;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming?: boolean;
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div
        className={cn("mt-1 text-lg font-semibold", highlight ?? "text-white")}
      >
        {value}
      </div>
    </div>
  );
}

function fmtBps(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

export function SimulationPreview({
  result,
  isLoading,
  onConfirm,
  onCancel,
  isConfirming,
}: Props) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-white/40">
        <Loader2 size={28} className="animate-spin" />
        <span className="text-sm">Simulating rebalance…</span>
      </div>
    );
  }

  if (!result) return null;

  if (result.skippedReason) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-10 text-center">
        <XCircle size={28} className="text-yellow-400" />
        <p className="text-sm text-white/70">{result.skippedReason}</p>
        <button
          onClick={onCancel}
          className="mt-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
        >
          Close
        </button>
      </div>
    );
  }

  const { plan, candidates } = result;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Current net APY"
          value={fmtBps(plan.currentBlendedNetApyBps)}
        />
        <Stat
          label="Proposed net APY"
          value={fmtBps(plan.proposedBlendedNetApyBps)}
          highlight="text-green-400"
        />
        <Stat
          label="Improvement"
          value={`+${fmtBps(plan.improvementBps)}`}
          highlight="text-blue-400"
        />
        <Stat
          label="Est. slippage"
          value={fmtBps(plan.estimatedSlippageBps)}
          highlight={
            plan.estimatedSlippageBps > 50 ? "text-red-400" : "text-white"
          }
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Est. fees" value={`$${plan.estimatedFeeUsd.toFixed(4)}`} />
        <Stat label="Est. gas" value={`$${plan.estimatedGasUsd.toFixed(4)}`} />
        <Stat
          label="30d earnings delta"
          value={`+$${plan.projectedEarningsDeltaUsd.d30.toFixed(2)}`}
          highlight="text-green-400"
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h4 className="mb-3 text-sm font-semibold text-white/80">
          Allocation changes
        </h4>
        <AllocationDiff candidates={candidates} targets={plan.targets} />
      </div>

      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={isConfirming}
          className={cn(
            "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white",
            isConfirming
              ? "bg-blue-500/50 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500"
          )}
        >
          {isConfirming ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Executing…
            </>
          ) : (
            <>
              <CheckCircle size={14} /> Confirm & execute
            </>
          )}
        </button>
      </div>
    </div>
  );
}
