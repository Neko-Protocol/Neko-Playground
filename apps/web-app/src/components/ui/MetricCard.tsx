"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  subValue?: string;
  highlight?: boolean;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MetricCard({
  label,
  value,
  subValue,
  highlight = false,
  trend,
  isLoading = false,
  size = "md",
  className,
}: MetricCardProps) {
  const sizeStyles = {
    sm: { label: "text-[10px]", value: "text-sm", subValue: "text-[10px]" },
    md: { label: "text-xs", value: "text-lg", subValue: "text-xs" },
    lg: { label: "text-sm", value: "text-2xl", subValue: "text-sm" },
  };

  const trendColors = {
    up: "text-[#4ADE80]",
    down: "text-[#EF4444]",
    neutral: "text-white",
  };

  const valueColor = highlight
    ? "text-[#4ADE80]"
    : trend
      ? trendColors[trend]
      : "text-white";

  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "text-white/40 font-medium uppercase tracking-wider mb-1",
          sizeStyles[size].label
        )}
      >
        {label}
      </span>
      {isLoading ? (
        <div
          className={cn(
            "h-5 w-16 rounded bg-white/10 animate-pulse",
            size === "lg" && "h-7 w-24"
          )}
        />
      ) : (
        <span className={cn("font-bold", sizeStyles[size].value, valueColor)}>
          {value}
        </span>
      )}
      {subValue && (
        <span className={cn("text-white/30 mt-0.5", sizeStyles[size].subValue)}>
          {subValue}
        </span>
      )}
    </div>
  );
}
