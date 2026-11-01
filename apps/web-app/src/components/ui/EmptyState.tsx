"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 rounded-2xl bg-[#1A1A1A] border border-white/5",
        className
      )}
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
        <div className="text-white/20">{icon}</div>
      </div>
      <h3 className="text-white/70 font-semibold text-base mb-1">{title}</h3>
      {description && (
        <p className="text-white/40 text-sm text-center max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
