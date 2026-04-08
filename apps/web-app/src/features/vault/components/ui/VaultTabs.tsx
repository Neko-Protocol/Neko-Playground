"use client";

import React from "react";

export type VaultTabKey = "vaults" | "positions";

interface VaultTabsProps {
  activeTab: VaultTabKey;
  onChange: (tab: VaultTabKey) => void;
}

export const VaultTabs: React.FC<VaultTabsProps> = ({
  activeTab,
  onChange,
}) => {
  return (
    <div className="flex bg-[#2A2A2A] rounded-xl p-1 gap-1 w-fit">
      <button
        onClick={() => onChange("vaults")}
        className={`py-2 px-5 rounded-lg text-sm font-medium transition-colors ${
          activeTab === "vaults"
            ? "bg-[#229EDF] text-white"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        Vaults
      </button>
      <button
        onClick={() => onChange("positions")}
        className={`py-2 px-5 rounded-lg text-sm font-medium transition-colors ${
          activeTab === "positions"
            ? "bg-[#229EDF] text-white"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        My Positions
      </button>
    </div>
  );
};
