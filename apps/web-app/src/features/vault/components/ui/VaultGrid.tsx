"use client";

import React from "react";
import { Vault } from "lucide-react";
import type { VaultView } from "../../types/vault";
import { VaultCard } from "./VaultCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

interface VaultGridProps {
  vaults: VaultView[];
  isLoading?: boolean;
  onDetailsClick?: (vault: VaultView) => void;
  onDepositClick?: () => void;
}

export const VaultGrid: React.FC<VaultGridProps> = ({
  vaults,
  isLoading,
  onDetailsClick,
  onDepositClick,
}) => {
  if (isLoading && vaults.length === 0) {
    return (
      <div className="rounded-2xl bg-[#1A1A1A] border border-white/5 p-16 flex flex-col items-center justify-center gap-4">
        <LoadingSpinner variant="dots" size="lg" />
        <span className="text-white/60 text-base font-medium">
          Loading vaults...
        </span>
      </div>
    );
  }

  if (vaults.length === 0) {
    return (
      <EmptyState
        icon={<Vault className="h-8 w-8" />}
        title="No vaults available"
        description="Vaults will appear here when they become available"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {vaults.map((vault) => (
        <VaultCard
          key={vault.id}
          vault={vault}
          isLoading={isLoading}
          onDetailsClick={onDetailsClick}
          onDepositClick={onDepositClick}
        />
      ))}
    </div>
  );
};
