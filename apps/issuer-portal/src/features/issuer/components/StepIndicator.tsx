"use client";

import { cn } from "@/lib/cn";

interface StepIndicatorProps {
  steps: string[];
  current: number;
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((label, idx) => {
        const state =
          idx < current ? "done" : idx === current ? "active" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border font-semibold",
                state === "active" &&
                  "border-neko-teal bg-neko-teal text-black",
                state === "done" &&
                  "border-neko-teal/40 bg-neko-teal/10 text-neko-teal",
                state === "upcoming" && "border-white/10 text-white/40"
              )}
            >
              {idx + 1}
            </span>
            <span
              className={cn(
                state === "upcoming" ? "text-white/40" : "text-white"
              )}
            >
              {label}
            </span>
            {idx < steps.length - 1 ? (
              <span className="mx-2 h-px w-6 bg-white/10" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
