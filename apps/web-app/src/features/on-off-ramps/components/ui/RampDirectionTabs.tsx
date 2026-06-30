"use client";

import React from "react";
import type { RampDirection } from "../../types/ramp";
import type { AnchorProvider } from "@/lib/anchors/types";
import { RAMP_PROVIDERS } from "../../constants/ramp.config";

const RAMP_TAB_IDS: Record<RampDirection, string> = {
  on: "on-ramp-tab",
  off: "off-ramp-tab",
};

const RAMP_PANEL_IDS: Record<RampDirection, string> = {
  on: "on-ramp-panel",
  off: "off-ramp-panel",
};

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

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    tab: RampDirection
  ) => {
    if (disabled) return;

    const tabs: RampDirection[] = ["on", "off"];
    const currentIndex = tabs.indexOf(tab);
    let nextTab: RampDirection | undefined;

    if (event.key === "ArrowRight") {
      nextTab = tabs[(currentIndex + 1) % tabs.length];
    } else if (event.key === "ArrowLeft") {
      nextTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
    } else if (event.key === "Home") {
      nextTab = tabs[0];
    } else if (event.key === "End") {
      nextTab = tabs[tabs.length - 1];
    }

    if (!nextTab) return;

    event.preventDefault();
    onChange(nextTab);
    requestAnimationFrame(() =>
      document.getElementById(RAMP_TAB_IDS[nextTab])?.focus()
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Ramp direction"
      className="flex bg-[#2A2A2A] rounded-xl p-1 gap-1"
    >
      <button
        id={RAMP_TAB_IDS.on}
        type="button"
        role="tab"
        aria-selected={direction === "on"}
        aria-controls={RAMP_PANEL_IDS.on}
        aria-disabled={disabled}
        tabIndex={direction === "on" ? 0 : -1}
        onClick={() => onChange("on")}
        onKeyDown={(event) => handleKeyDown(event, "on")}
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
        id={RAMP_TAB_IDS.off}
        type="button"
        role="tab"
        aria-selected={direction === "off"}
        aria-controls={RAMP_PANEL_IDS.off}
        aria-disabled={disabled}
        tabIndex={direction === "off" ? 0 : -1}
        onClick={() => onChange("off")}
        onKeyDown={(event) => handleKeyDown(event, "off")}
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
