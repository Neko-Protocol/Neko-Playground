"use client";

import React from "react";
import { CheckCircle, XCircle, History } from "lucide-react";
import { useVaultRunHistory } from "../../hooks/useVaultRunHistory";

const KIND_LABEL: Record<string, string> = {
  "harvest-aquarius": "Harvest Aquarius rewards",
  "invest-idle": "Invest idle funds",
  "collect-fees": "Collect fees",
};

function stepLabel(message: string): string {
  const match = message.match(/\((.+?)\)/);
  const kind = match?.[1];
  return kind ? (KIND_LABEL[kind] ?? kind) : message;
}

export function VaultRunHistory() {
  const { data: entries = [], isLoading } = useVaultRunHistory();

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-white/5" />;
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
        <History className="h-3 w-3 text-white/30" />
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          Auto-invest run history
        </span>
      </div>

      {entries.length === 0 ? (
        <div className="py-8 text-center text-sm text-white/40">
          No auto-invest runs yet.
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {entries.slice(0, 20).map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 px-4 py-2.5 text-sm"
            >
              {entry.level === "error" ? (
                <XCircle size={14} className="shrink-0 text-red-400" />
              ) : (
                <CheckCircle size={14} className="shrink-0 text-green-400" />
              )}
              <span className="flex-1 text-white/70">
                {stepLabel(entry.message)}
              </span>
              <span className="text-xs text-white/30">
                {new Date(entry.occurredAt).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default VaultRunHistory;
