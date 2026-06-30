"use client";

import React from "react";

export type VaultTabKey = "vaults" | "positions";

const VAULT_TAB_IDS: Record<VaultTabKey, string> = {
  vaults: "vaults-tab",
  positions: "vault-positions-tab",
};

const VAULT_PANEL_IDS: Record<VaultTabKey, string> = {
  vaults: "vaults-panel",
  positions: "vault-positions-panel",
};

interface VaultTabsProps {
  activeTab: VaultTabKey;
  onChange: (tab: VaultTabKey) => void;
}

export const VaultTabs: React.FC<VaultTabsProps> = ({
  activeTab,
  onChange,
}) => {
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    tab: VaultTabKey
  ) => {
    const tabs: VaultTabKey[] = ["vaults", "positions"];
    const currentIndex = tabs.indexOf(tab);
    let nextTab: VaultTabKey | undefined;

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
      document.getElementById(VAULT_TAB_IDS[nextTab])?.focus()
    );
  };

  return (
    <div
      role="tablist"
      aria-label="Vault views"
      className="flex bg-[#2A2A2A] rounded-xl p-1 gap-1 w-fit"
    >
      <button
        id={VAULT_TAB_IDS.vaults}
        type="button"
        role="tab"
        aria-selected={activeTab === "vaults"}
        aria-controls={VAULT_PANEL_IDS.vaults}
        tabIndex={activeTab === "vaults" ? 0 : -1}
        onClick={() => onChange("vaults")}
        onKeyDown={(event) => handleKeyDown(event, "vaults")}
        className={`py-2 px-5 rounded-lg text-sm font-medium transition-colors ${
          activeTab === "vaults"
            ? "bg-[#229EDF] text-white"
            : "text-white/50 hover:text-white/80"
        }`}
      >
        Vaults
      </button>
      <button
        id={VAULT_TAB_IDS.positions}
        type="button"
        role="tab"
        aria-selected={activeTab === "positions"}
        aria-controls={VAULT_PANEL_IDS.positions}
        tabIndex={activeTab === "positions" ? 0 : -1}
        onClick={() => onChange("positions")}
        onKeyDown={(event) => handleKeyDown(event, "positions")}
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
