"use client";

import React from "react";

export interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <div className="rounded-[20px] bg-[#1C1C1C] p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
