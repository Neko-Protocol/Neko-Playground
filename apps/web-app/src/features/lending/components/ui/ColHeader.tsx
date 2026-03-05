import React from "react";
import { Info } from "lucide-react";

interface ColHeaderProps {
  icon: React.ElementType;
  label: string;
  tooltip?: string;
  centered?: boolean;
}

export function ColHeader({
  icon: Icon,
  label,
  tooltip,
  centered,
}: ColHeaderProps) {
  return (
    <th className={`px-4 py-3 ${centered ? "text-center" : "text-left"}`}>
      <div
        className={`flex items-center gap-1.5 text-white/40 text-xs font-semibold uppercase tracking-wide ${centered ? "justify-center" : ""}`}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
        {tooltip && (
          <div className="group relative">
            <Info className="h-3 w-3 cursor-help" />
            <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-1 hidden group-hover:block w-48 rounded-lg bg-[#2A2A2A] px-2 py-1 text-[10px] text-white/70 shadow-xl z-50">
              {tooltip}
            </div>
          </div>
        )}
      </div>
    </th>
  );
}
