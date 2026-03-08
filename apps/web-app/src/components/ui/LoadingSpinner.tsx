"use client";

import React from "react";
import { cn } from "@/lib/utils";

type LoadingSpinnerVariant = "dots" | "spinner";

export interface LoadingSpinnerProps {
  variant?: LoadingSpinnerVariant;

  className?: string;

  size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<LoadingSpinnerVariant, Record<string, string>> = {
  dots: { sm: "w-2 h-2", md: "w-2 h-2", lg: "w-3 h-3" },
  spinner: {
    sm: "h-4 w-4 border-2",
    md: "h-6 w-6 border-4",
    lg: "h-8 w-8 border-4",
  },
};

export function LoadingSpinner({
  variant = "spinner",
  className,
  size = "md",
}: LoadingSpinnerProps) {
  if (variant === "dots") {
    const dotClass = cn(
      "rounded-full animate-pulse bg-white/50",
      sizeClasses.dots[size],
      className
    );
    return (
      <span className="inline-flex gap-1" aria-label="Loading">
        <span className={cn(dotClass, "[animation-delay:0ms]")} />
        <span className={cn(dotClass, "[animation-delay:200ms]")} />
        <span className={cn(dotClass, "[animation-delay:400ms]")} />
      </span>
    );
  }

  return (
    <div
      className={cn(
        "animate-spin rounded-full border-solid border-neko-teal border-r-transparent",
        sizeClasses.spinner[size],
        className
      )}
      aria-label="Loading"
    />
  );
}
