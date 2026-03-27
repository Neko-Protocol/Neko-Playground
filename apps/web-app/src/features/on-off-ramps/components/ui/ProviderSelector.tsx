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
          const isComingSoon = key === "alfredpay";
          return (
            <button
              key={key}
              onClick={() => !isComingSoon && onSelect(key)}
              disabled={disabled || isComingSoon}
              className={`relative flex flex-col gap-1 rounded-xl p-4 border transition-all text-left disabled:cursor-not-allowed ${
                isComingSoon
                  ? "bg-[#2A2A2A] border-white/5 opacity-40"
                  : isActive
                    ? "bg-[#229EDF]/10 border-[#229EDF]"
                    : "bg-[#2A2A2A] border-white/10 hover:border-white/30"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-sm font-semibold ${isActive && !isComingSoon ? "text-[#229EDF]" : "text-white"}`}
                >
                  {config.displayName}
                </span>
                {isComingSoon && (
                  <span className="text-[10px] font-medium text-white/40 bg-white/10 px-1.5 py-0.5 rounded">
                    Soon
                  </span>
                )}
              </div>
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
