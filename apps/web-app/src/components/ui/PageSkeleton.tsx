"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  PageContainer,
  type PageContainerProps,
} from "@/components/ui/PageContainer";

export type PageSkeletonVariant = "cards" | "form" | "detail" | "table";

export interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  maxWidth?: PageContainerProps["maxWidth"];
  className?: string;
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-white/10", className)}
      aria-hidden
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl border border-white/5 bg-[#1C1C1C] p-4 sm:p-6",
        className
      )}
      aria-hidden
    >
      <SkeletonBar className="mb-4 h-4 w-1/3 bg-neko-border/40" />
      <SkeletonBar className="mb-2 h-8 w-2/3" />
      <SkeletonBar className="h-3 w-1/2 bg-neko-muted/20" />
    </div>
  );
}

function CardsSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <SkeletonBar className="h-32 w-full rounded-2xl bg-neko-accent/20 sm:h-36" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <SkeletonBar className="mx-auto h-10 w-48" />
      <div className="space-y-4 rounded-2xl border border-neko-border/30 bg-[#1C1C1C] p-6">
        <SkeletonBar className="h-14 w-full rounded-xl" />
        <div className="flex justify-center">
          <SkeletonBar className="h-8 w-8 rounded-full bg-neko-teal/30" />
        </div>
        <SkeletonBar className="h-14 w-full rounded-xl" />
        <SkeletonBar className="h-12 w-full rounded-xl bg-neko-accent/30" />
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonBar className="h-4 w-32 bg-neko-muted/20" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SkeletonBar className="h-10 w-2/3" />
          <SkeletonBar className="h-48 w-full rounded-2xl bg-neko-accent/15" />
          <SkeletonBar className="h-24 w-full rounded-2xl" />
        </div>
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <SkeletonBar className="h-10 w-64" />
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#1C1C1C]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-white/5 px-4 py-4 last:border-b-0"
          >
            <SkeletonBar className="h-8 w-8 rounded-full bg-neko-teal/30" />
            <SkeletonBar className="h-4 flex-1" />
            <SkeletonBar className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

const VARIANT_CONTENT: Record<PageSkeletonVariant, () => ReactNode> = {
  cards: CardsSkeleton,
  form: FormSkeleton,
  detail: DetailSkeleton,
  table: TableSkeleton,
};

export function PageSkeleton({
  variant = "cards",
  maxWidth = "6xl",
  className,
}: PageSkeletonProps) {
  const Content = VARIANT_CONTENT[variant];

  return (
    <div
      className={cn(
        "w-full min-w-0 max-w-full min-h-[50vh] overflow-x-hidden py-6 sm:py-8",
        className
      )}
      aria-busy="true"
      aria-label="Loading"
    >
      <PageContainer maxWidth={maxWidth} className="space-y-6">
        <SkeletonBar className="h-8 w-48 sm:h-10 sm:w-56" />
        <Content />
      </PageContainer>
    </div>
  );
}
