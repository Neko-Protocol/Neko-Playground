"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AllocationTarget, VenueCandidate } from "../../types/automation";

interface Props {
  candidates: VenueCandidate[];
  targets: AllocationTarget[];
}

function fmtBps(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function fmtUsd(n: number) {
  return `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function AllocationDiff({ candidates, targets }: Props) {
  const byId = Object.fromEntries(candidates.map((c) => [c.id, c]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-white/40">
            <th className="pb-2 text-left font-medium">Venue</th>
            <th className="pb-2 text-right font-medium">Current</th>
            <th className="pb-2 text-center font-medium" />
            <th className="pb-2 text-right font-medium">Target</th>
            <th className="pb-2 text-right font-medium">Delta</th>
            <th className="pb-2 text-right font-medium">Net APY</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {targets.map((t) => {
            const c = byId[t.venueId];
            if (!c) return null;
            const isInflow = t.deltaUsd > 0;
            return (
              <tr key={t.venueId}>
                <td className="py-2.5 text-white font-medium">{c.name}</td>
                <td className="py-2.5 text-right text-white/60">
                  {c.currentAllocationPct.toFixed(1)}%
                </td>
                <td className="py-2.5 text-center text-white/30">
                  <ArrowRight size={14} />
                </td>
                <td className="py-2.5 text-right text-white">
                  {t.targetPct.toFixed(1)}%
                </td>
                <td
                  className={cn(
                    "py-2.5 text-right font-medium",
                    isInflow ? "text-green-400" : "text-red-400"
                  )}
                >
                  {isInflow ? "+" : "-"}
                  {fmtUsd(t.deltaUsd)}
                </td>
                <td className="py-2.5 text-right text-white/70">
                  {fmtBps(c.netApyBps)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
