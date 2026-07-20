"use client";

import { ActivityFilters } from "../../hooks/useActivityFeed";

interface ActivityFiltersProps {
  filters: ActivityFilters;
  onChange: (filters: ActivityFilters) => void;
}

export function ActivityFiltersControl({
  filters,
  onChange,
}: ActivityFiltersProps) {
  const sources = [
    { value: "swap", label: "Swap" },
    { value: "automation", label: "Automation" },
    { value: "vault", label: "Vault" },
  ];

  const dateRanges = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
    { value: "all", label: "All Time" },
  ];

  const toggleSource = (source: "swap" | "automation" | "vault") => {
    const currentSources = filters.sources || [];
    let newSources: ("swap" | "automation" | "vault")[];

    if (currentSources.includes(source)) {
      newSources = currentSources.filter((s) => s !== source);
    } else {
      newSources = [...currentSources, source];
    }

    onChange({ ...filters, sources: newSources });
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between mb-6">
      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const isActive = (filters.sources || []).includes(
            source.value as any
          );
          return (
            <button
              key={source.value}
              onClick={() => toggleSource(source.value as any)}
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                isActive
                  ? "bg-white text-black font-medium"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {source.label}
            </button>
          );
        })}
      </div>

      <div className="flex bg-white/5 rounded-lg p-1">
        {dateRanges.map((range) => {
          const isActive = (filters.dateRange || "all") === range.value;
          return (
            <button
              key={range.value}
              onClick={() =>
                onChange({ ...filters, dateRange: range.value as any })
              }
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                isActive
                  ? "bg-[#2a2a2a] text-white"
                  : "text-white/40 hover:text-white/80"
              }`}
            >
              {range.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
