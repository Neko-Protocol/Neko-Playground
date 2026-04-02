"use client";

import React from "react";
import { Vault } from "lucide-react";
import type { VaultData } from "../../types/vault";
import { VaultCard } from "./VaultCard";

interface VaultGridProps {
  vaults: VaultData[];
  onDetailsClick?: (vault: VaultData) => void;
}

export const VaultGrid: React.FC<VaultGridProps> = ({
  vaults,
  onDetailsClick,
}) => {
  if (vaults.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-[#1C1C1C] border border-white/5 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
          <Vault className="h-7 w-7 text-white/20" />
        </div>
        <div className="text-center">
          <p className="text-white/50 font-medium mb-1">No vaults found</p>
          <p className="text-white/25 text-sm">Try adjusting your filters</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {vaults.map((vault) => (
        <VaultCard
          key={vault.id}
          vault={vault}
          onDetailsClick={onDetailsClick}
        />
      ))}
    </div>
  );
};
