"use client";

import React from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  isLoading = false,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-[#1C1C1C] border border-white/5 p-4 sm:p-5 flex flex-col gap-3",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-white/40 text-xs font-medium">{label}</p>
        <div className="p-1.5 bg-[#2A2A2A] rounded-lg text-white/40">
          {icon}
        </div>
      </div>
      <h3 className="text-2xl sm:text-3xl font-bold text-white wrap-break-word">
        {isLoading ? <LoadingSpinner variant="dots" size="md" /> : value}
      </h3>
    </div>
  );
}
