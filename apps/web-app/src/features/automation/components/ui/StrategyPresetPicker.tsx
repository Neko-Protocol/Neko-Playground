"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { PRESET_LABELS, PRESET_DESCRIPTIONS } from "../../const/automation";
import type { StrategyPreset } from "../../types/automation";

interface Props {
  value: StrategyPreset;
  onChange: (preset: StrategyPreset) => void;
}

const PRESETS: StrategyPreset[] = [
  "conservative",
  "balanced",
  "aggressive",
  "custom",
];

export function StrategyPresetPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {PRESETS.map((preset) => (
        <button
          key={preset}
          onClick={() => onChange(preset)}
          className={cn(
            "rounded-xl border p-4 text-left transition-all",
            value === preset
              ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
              : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
          )}
        >
          <div className="font-semibold text-sm text-white">
            {PRESET_LABELS[preset]}
          </div>
          <div className="mt-1 text-xs text-white/50">
            {PRESET_DESCRIPTIONS[preset]}
          </div>
        </button>
      ))}
    </div>
  );
}
