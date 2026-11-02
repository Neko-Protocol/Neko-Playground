"use client";

import React, { useMemo, useState } from "react";
import { PageContainer } from "@/components/ui/PageContainer";
import { VaultGrid } from "../ui/VaultGrid";
import { VaultDetailModal } from "../ui/VaultDetailModal";
import { VaultActionModal } from "../ui/VaultActionModal";
import { VAULT_REGISTRY } from "../../const/vaults";
import { useVaultData } from "../../hooks/useVaultData";
import { useVaultApy } from "../../hooks/useVaultApy";
import type { VaultView } from "../../types/vault";

const Vault: React.FC = () => {
  const [selectedVault, setSelectedVault] = useState<VaultView | null>(null);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    isDeposit: boolean;
  }>({ open: false, isDeposit: true });

  const { data: vaultData, isLoading } = useVaultData();
  const { data: apyData } = useVaultApy();

  const vaults = useMemo<VaultView[]>(
    () =>
      Object.values(VAULT_REGISTRY).map((config) => ({
        ...config,
        tvl: isLoading
          ? "Loading..."
          : vaultData && vaultData.tvl > 0n
            ? vaultData.tvlFormatted
            : "—",
        apy7d:
          apyData?.vaultApy != null ? `${apyData.vaultApy.toFixed(2)}%` : "—",
        utilization: "—",
        totalSupply:
          vaultData && vaultData.totalShares > 0n
            ? `${(Number(vaultData.totalShares) / 1e7).toLocaleString()} dfTokens`
            : "—",
      })),
    [vaultData, apyData, isLoading]
  );

  const openDepositModal = () =>
    setActionModal({ open: true, isDeposit: true });

  return (
    <PageContainer maxWidth="6xl" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Vaults</h1>
        <p className="text-white/50 text-sm mt-1">
          Automated yield strategies backed by real-world collateral
        </p>
      </div>

      {/* Vault Grid */}
      <VaultGrid
        vaults={vaults}
        isLoading={isLoading}
        onDetailsClick={setSelectedVault}
        onDepositClick={openDepositModal}
      />

      {selectedVault && (
        <VaultDetailModal
          vault={selectedVault}
          onClose={() => setSelectedVault(null)}
          onDeposit={() => {
            setSelectedVault(null);
            openDepositModal();
          }}
        />
      )}

      {actionModal.open && (
        <VaultActionModal
          isDeposit={actionModal.isDeposit}
          onClose={() => setActionModal({ open: false, isDeposit: true })}
        />
      )}
    </PageContainer>
  );
};

export default Vault;
