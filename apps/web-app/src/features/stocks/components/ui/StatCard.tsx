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
        "rounded-2xl bg-gradient-to-br from-neko-accent to-neko-border p-6 shadow-xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 hover:from-[#4A73C4] hover:to-[#3D5AC0]",
        className
      )}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-white/10 text-white/70 rounded-lg backdrop-blur-sm">
          {icon}
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
          {label}
        </p>
      </div>
      <h3 className="text-3xl font-bold text-white">
        {isLoading ? <LoadingSpinner variant="dots" size="md" /> : value}
      </h3>
    </div>
  );
}
