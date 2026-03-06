"use client";

import { cn } from "@/lib/utils";

type PageContainerMaxWidth = "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";

const MAX_WIDTH_CLASS: Record<PageContainerMaxWidth, string> = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
  full: "max-w-full",
};

export interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: PageContainerMaxWidth;
  className?: string;
}

export function PageContainer({
  children,
  maxWidth = "6xl",
  className,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full min-w-0 mx-auto",
        MAX_WIDTH_CLASS[maxWidth],
        className
      )}
    >
      {children}
    </div>
  );
}
