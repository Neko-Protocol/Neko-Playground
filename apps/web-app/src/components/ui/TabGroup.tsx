"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface Tab {
  key: string;
  label: string;
  badge?: number;
}

export interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export function TabGroup({
  tabs,
  activeTab,
  onChange,
  size = "md",
  className,
}: TabGroupProps) {
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2 text-sm",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-xl bg-[#1A1A1A] p-1 border border-white/5",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative rounded-lg font-semibold transition-all duration-200",
            sizeStyles[size],
            activeTab === tab.key
              ? "bg-[#229EDF] text-white shadow-lg shadow-[#229EDF]/20"
              : "text-white/40 hover:text-white/70 hover:bg-white/5"
          )}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-[#229EDF] text-[9px] font-bold text-white">
              {tab.badge > 99 ? "99+" : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
