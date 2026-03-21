"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface BackstopStatCardProps {
  label: string;
  value: string;
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function BackstopStatCard({
  label,
  value,
  isLoading,
  onRefresh,
  className,
}: BackstopStatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-[#1C1C1C] border border-white/5 p-4",
        className
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/40 text-xs font-medium">{label}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            aria-label={`Refresh ${label}`}
            className="text-white/30 hover:text-white/60 transition-colors disabled:opacity-30"
          >
            <RefreshCw
              className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`}
            />
          </button>
        )}
      </div>
      {isLoading ? (
        <div className="h-7 w-24 rounded bg-white/10 animate-pulse" />
      ) : (
        <p className="text-white font-bold text-xl tabular-nums">{value}</p>
      )}
    </div>
  );
}
