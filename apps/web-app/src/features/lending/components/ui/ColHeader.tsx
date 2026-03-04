import React from "react";

interface ColHeaderProps {
  icon: React.ElementType;
  label: string;
  centered?: boolean;
}

export function ColHeader({ icon: Icon, label, centered }: ColHeaderProps) {
  return (
    <th className={`px-4 py-3 ${centered ? "text-center" : "text-left"}`}>
      <div
        className={`flex items-center gap-1.5 text-white/40 text-xs font-semibold uppercase tracking-wide ${centered ? "justify-center" : ""}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
    </th>
  );
}
