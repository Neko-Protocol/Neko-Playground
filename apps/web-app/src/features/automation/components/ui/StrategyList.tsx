"use client";

import React from "react";
import { Plus, Play, Pencil, Trash2, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRESET_LABELS } from "../../const/automation";
import type { Strategy } from "../../types/automation";

interface Props {
  strategies: Strategy[];
  selected: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onEdit: (s: Strategy) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
  isLoading?: boolean;
}

export function StrategyList({
  strategies,
  selected,
  onSelect,
  onNew,
  onEdit,
  onDelete,
  onToggle,
  onRun,
  isLoading,
}: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {strategies.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-white/40">
          No strategies yet. Create one to get started.
        </div>
      )}

      {strategies.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={cn(
            "w-full rounded-xl border p-4 text-left transition-all",
            selected === s.id
              ? "border-blue-500 bg-blue-500/10"
              : "border-white/10 bg-white/5 hover:border-white/20"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    s.enabled ? "bg-green-400" : "bg-white/20"
                  )}
                />
                <span className="truncate font-semibold text-sm text-white">
                  {s.name}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  {PRESET_LABELS[s.preset]}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/60">
                  {s.rule.improvementThresholdBps}bps threshold
                </span>
              </div>
            </div>
            <div
              className="flex gap-1 flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onRun(s.id)}
                title="Run now"
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <Play size={14} />
              </button>
              <button
                onClick={() => onToggle(s.id, !s.enabled)}
                title={s.enabled ? "Disable" : "Enable"}
                className={cn(
                  "rounded-lg p-1.5 hover:bg-white/10",
                  s.enabled
                    ? "text-green-400 hover:text-green-300"
                    : "text-white/40 hover:text-white"
                )}
              >
                <Power size={14} />
              </button>
              <button
                onClick={() => onEdit(s)}
                title="Edit"
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => onDelete(s.id)}
                title="Delete"
                className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/20 hover:text-red-400"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </button>
      ))}

      <button
        onClick={onNew}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-sm text-white/50 transition-colors hover:border-blue-500/50 hover:text-blue-400"
      >
        <Plus size={16} /> New strategy
      </button>
    </div>
  );
}
