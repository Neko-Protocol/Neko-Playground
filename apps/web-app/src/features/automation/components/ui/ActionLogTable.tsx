"use client";

import React, { useState } from "react";
import { Download, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportToCsv } from "../../hooks/useActionLog";
import type { ActionLogEntry } from "../../types/automation";

interface Props {
  entries: ActionLogEntry[];
  isLoading?: boolean;
}

const OUTCOME_COLORS: Record<ActionLogEntry["outcome"], string> = {
  executed: "text-green-400 bg-green-500/10",
  simulated: "text-blue-400 bg-blue-500/10",
  skipped: "text-white/40 bg-white/5",
  failed: "text-red-400 bg-red-500/10",
  aborted: "text-yellow-400 bg-yellow-500/10",
};

function fmtBps(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

export function ActionLogTable({ entries, isLoading }: Props) {
  const [filter, setFilter] = useState<ActionLogEntry["outcome"] | "all">(
    "all"
  );
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-xl bg-white/5" />;
  }

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.outcome === filter);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          {(
            [
              "all",
              "executed",
              "simulated",
              "skipped",
              "failed",
              "aborted",
            ] as const
          ).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-white/50 hover:text-white"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportToCsv(entries)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
          No log entries.
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((entry) => (
          <div
            key={entry.id}
            className="rounded-xl border border-white/10 bg-white/[0.03]"
          >
            <button
              onClick={() =>
                setExpanded(expanded === entry.id ? null : entry.id)
              }
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                  OUTCOME_COLORS[entry.outcome]
                )}
              >
                {entry.outcome}
              </span>
              <span className="flex-1 text-sm text-white truncate">
                {entry.strategyName}
              </span>
              <span className="text-xs text-white/40">
                {new Date(entry.timestamp).toLocaleString()}
              </span>
              {expanded === entry.id ? (
                <ChevronUp size={14} className="text-white/30" />
              ) : (
                <ChevronDown size={14} className="text-white/30" />
              )}
            </button>

            {expanded === entry.id && (
              <div className="border-t border-white/5 px-4 pb-4 pt-3">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-white/40 text-xs">Trigger</dt>
                    <dd className="text-white mt-0.5">{entry.triggerReason}</dd>
                  </div>
                  <div>
                    <dt className="text-white/40 text-xs">Candidates</dt>
                    <dd className="text-white mt-0.5">
                      {entry.candidatesConsidered}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/40 text-xs">Proposed APY</dt>
                    <dd className="text-white mt-0.5">
                      {fmtBps(entry.proposedNetApyBps)}
                    </dd>
                  </div>
                  {entry.realizedNetApyBps !== undefined && (
                    <div>
                      <dt className="text-white/40 text-xs">Realized APY</dt>
                      <dd className="text-green-400 mt-0.5">
                        {fmtBps(entry.realizedNetApyBps)}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-white/40 text-xs">Est. Slippage</dt>
                    <dd className="text-white mt-0.5">
                      {fmtBps(entry.estimatedSlippageBps)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/40 text-xs">Est. Fees</dt>
                    <dd className="text-white mt-0.5">
                      ${entry.estimatedFeeUsd.toFixed(4)}
                    </dd>
                  </div>
                  {entry.txHashes.length > 0 && (
                    <div className="col-span-full">
                      <dt className="text-white/40 text-xs">Transactions</dt>
                      <dd className="mt-0.5 flex flex-wrap gap-2">
                        {entry.txHashes.map((hash) => (
                          <a
                            key={hash}
                            href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-blue-400 hover:underline"
                          >
                            {hash.slice(0, 8)}…{hash.slice(-6)}
                          </a>
                        ))}
                      </dd>
                    </div>
                  )}
                  {entry.notes && (
                    <div className="col-span-full">
                      <dt className="text-white/40 text-xs">Notes</dt>
                      <dd className="text-white/70 mt-0.5 text-xs">
                        {entry.notes}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
