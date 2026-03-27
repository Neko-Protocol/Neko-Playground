"use client";

import React from "react";
import type { AnchorProvider } from "@/lib/anchors/types";
import { RAMP_PROVIDERS } from "../../constants/ramp.config";

interface ProviderSelectorProps {
  selected: AnchorProvider;
  onSelect: (provider: AnchorProvider) => void;
  disabled?: boolean;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selected,
  onSelect,
  disabled,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-white/50 text-sm font-medium">Select Provider</span>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(RAMP_PROVIDERS) as AnchorProvider[]).map((key) => {
          const config = RAMP_PROVIDERS[key];
          const isActive = selected === key;
          return (
            <button
              key={key}
              onClick={() => onSelect(key)}
              disabled={disabled}
              className={`flex flex-col gap-1 rounded-xl p-4 border transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? "bg-[#229EDF]/10 border-[#229EDF]"
                  : "bg-[#2A2A2A] border-white/10 hover:border-white/30"
              }`}
            >
              <span
                className={`text-sm font-semibold ${isActive ? "text-[#229EDF]" : "text-white"}`}
              >
                {config.displayName}
              </span>
              <span className="text-white/40 text-xs">
                {config.description}
              </span>
              <span className="text-white/30 text-xs mt-1">
                {config.region} · {config.paymentMethod}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
