"use client";

import React from "react";
import { Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export type RiskLevel = "low" | "medium" | "high";

export interface RiskBadgeProps {
  level: RiskLevel;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  low: {
    label: "Low Risk",
    color: "text-[#4ADE80]",
    bg: "bg-[#4ADE80]/10",
    icon: ShieldCheck,
  },
  medium: {
    label: "Medium Risk",
    color: "text-[#FBBF24]",
    bg: "bg-[#FBBF24]/10",
    icon: Shield,
  },
  high: {
    label: "High Risk",
    color: "text-[#EF4444]",
    bg: "bg-[#EF4444]/10",
    icon: ShieldAlert,
  },
};

export function RiskBadge({
  level,
  showLabel = true,
  size = "sm",
  className,
}: RiskBadgeProps) {
  const config = RISK_CONFIG[level];
  const Icon = config.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const padding = size === "sm" ? "px-2 py-1" : "px-3 py-1.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold",
        config.bg,
        config.color,
        padding,
        textSize,
        className
      )}
    >
      <Icon className={iconSize} />
      {showLabel && <span>{config.label}</span>}
    </div>
  );
}
