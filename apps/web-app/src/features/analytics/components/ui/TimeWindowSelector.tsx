"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { TIME_WINDOWS } from "../../const/analytics";
import type { TimeWindow } from "../../types/analytics";

interface TimeWindowSelectorProps {
  value: TimeWindow;
  onChange: (w: TimeWindow) => void;
  className?: string;
}

export function TimeWindowSelector({
  value,
  onChange,
  className,
}: TimeWindowSelectorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-xl bg-[#1C1C1C] border border-white/5 p-1",
        className
      )}
    >
      {TIME_WINDOWS.map((w) => (
        <button
          key={w.value}
          onClick={() => onChange(w.value)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
            value === w.value
              ? "bg-[#2A2A2A] text-white"
              : "text-white/40 hover:text-white/70"
          )}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
