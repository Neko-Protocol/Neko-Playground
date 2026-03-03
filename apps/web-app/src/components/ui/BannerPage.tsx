"use client";

import React from "react";

interface BannerPageProps {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}

export function BannerPage({ title, subtitle, children }: BannerPageProps) {
  return (
    <div className="rounded-3xl bg-neko-accent p-8 shadow-lg border border-neko-border/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-neko-border/20 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10">
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-neko-muted text-lg leading-relaxed mb-6">
          {subtitle}
        </p>
        {children}
      </div>
    </div>
  );
}
