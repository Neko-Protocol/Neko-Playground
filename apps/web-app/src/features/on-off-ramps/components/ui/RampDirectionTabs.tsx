"use client";

import React from "react";
import type { RampDirection } from "../../types/ramp";
import type { AnchorProvider } from "@/lib/anchors/types";
import { RAMP_PROVIDERS } from "../../constants/ramp.config";

interface RampDirectionTabsProps {
  direction: RampDirection;
  provider: AnchorProvider;
  onChange: (direction: RampDirection) => void;
  disabled?: boolean;
}

export const RampDirectionTabs: React.FC<RampDirectionTabsProps> = ({
  direction,
  provider,
  onChange,
  disabled,
}) => {
  const config = RAMP_PROVIDERS[provider];

  return (
    <div className="flex bg-[#2A2A2A] rounded-xl p-1 gap-1">
      <button
        onClick={() => onChange("on")}
        disabled={disabled}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          direction === "on"
            ? "bg-[#229EDF] text-white"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        On-Ramp
        <span className="block text-xs font-normal opacity-70 mt-0.5">
          {config.onRampLabel}
        </span>
      </button>
      <button
        onClick={() => onChange("off")}
        disabled={disabled}
        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
          direction === "off"
            ? "bg-[#229EDF] text-white"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        Off-Ramp
        <span className="block text-xs font-normal opacity-70 mt-0.5">
          {config.offRampLabel}
        </span>
      </button>
    </div>
  );
};
