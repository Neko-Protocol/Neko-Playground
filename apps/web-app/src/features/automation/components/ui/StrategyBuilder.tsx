"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { StrategyPresetPicker } from "./StrategyPresetPicker";
import { RuleEditor } from "./RuleEditor";
import { PRESET_RULES } from "../../const/automation";
import type { Strategy, StrategyPreset } from "../../types/automation";

interface Props {
  initial?: Strategy;
  onSave: (data: Omit<Strategy, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function StrategyBuilder({
  initial,
  onSave,
  onCancel,
  isSaving,
}: Props) {
  const [name, setName] = useState(initial?.name ?? "My Strategy");
  const [preset, setPreset] = useState<StrategyPreset>(
    initial?.preset ?? "balanced"
  );
  const [rule, setRule] = useState(initial?.rule ?? PRESET_RULES.balanced);

  const handlePresetChange = (p: StrategyPreset) => {
    setPreset(p);
    if (p !== "custom") setRule(PRESET_RULES[p]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      preset,
      rule,
      enabled: initial?.enabled ?? false,
      lastRunAt: initial?.lastRunAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1117] p-6 shadow-2xl">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 rounded-lg p-1 text-white/40 hover:text-white"
        >
          <X size={18} />
        </button>

        <h2 className="mb-6 text-lg font-bold text-white">
          {initial ? "Edit Strategy" : "New Strategy"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/60">
              Strategy name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-white/60">Preset</p>
            <StrategyPresetPicker
              value={preset}
              onChange={handlePresetChange}
            />
          </div>

          <RuleEditor rule={rule} onChange={setRule} />

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors",
                isSaving
                  ? "bg-blue-500/50 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500"
              )}
            >
              {isSaving ? "Saving…" : "Save strategy"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
