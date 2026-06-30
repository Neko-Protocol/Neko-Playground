"use client";

import React, { useMemo, useState } from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { VaultGrid } from "../ui/VaultGrid";
import { VaultDetailModal } from "../ui/VaultDetailModal";
import { VaultTabs, type VaultTabKey } from "../ui/VaultTabs";
import { VaultActionModal } from "../ui/VaultActionModal";
import MyVaultPositions from "../ui/MyVaultPositions";
import { VAULT_REGISTRY } from "../../const/vaults";
import { useVaultData } from "../../hooks/useVaultData";
import { useVaultApy } from "../../hooks/useVaultApy";
import type { VaultView } from "../../types/vault";

const Vault: React.FC = () => {
  const [selectedVault, setSelectedVault] = useState<VaultView | null>(null);
  const [activeTab, setActiveTab] = useState<VaultTabKey>("vaults");
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
  const openWithdrawModal = () =>
    setActionModal({ open: true, isDeposit: false });

  return (
    <PageContainer maxWidth="6xl">
      <BannerPage
        title="Vaults"
        subtitle="Deposit assets into yield-generating vaults backed by real-world collateral on Stellar"
        badge="Earn yield"
        imageSrc="/banners/vault.svg"
        imageAlt="Vault illustration"
        className="mb-8"
      />

      <div className="mb-6">
        <VaultTabs activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {activeTab === "vaults" ? (
        <>
          <div
            id="vaults-panel"
            role="tabpanel"
            aria-labelledby="vaults-tab"
            tabIndex={0}
          >
            <VaultGrid
              vaults={vaults}
              isLoading={isLoading}
              onDetailsClick={setSelectedVault}
              onDepositClick={openDepositModal}
            />
          </div>
          <div
            id="vault-positions-panel"
            role="tabpanel"
            aria-labelledby="vault-positions-tab"
            hidden
          />
        </>
      ) : (
        <>
          <div
            id="vaults-panel"
            role="tabpanel"
            aria-labelledby="vaults-tab"
            hidden
          />
          <div
            id="vault-positions-panel"
            role="tabpanel"
            aria-labelledby="vault-positions-tab"
            tabIndex={0}
          >
            <MyVaultPositions />
          </div>
        </>
      )}

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
