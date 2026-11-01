"use client";

import React, { useMemo, useState } from "react";
import { Vault as VaultIcon, TrendingUp, ShieldCheck } from "lucide-react";
import { PageContainer } from "@/components/ui/PageContainer";
import { TabGroup } from "@/components/ui/TabGroup";
import { VaultGrid } from "../ui/VaultGrid";
import { VaultDetailModal } from "../ui/VaultDetailModal";
import { VaultActionModal } from "../ui/VaultActionModal";
import MyVaultPositions from "../ui/MyVaultPositions";
import { VaultRunHistory } from "../ui/VaultRunHistory";
import { VAULT_REGISTRY } from "../../const/vaults";
import { useVaultData } from "../../hooks/useVaultData";
import { useVaultApy } from "../../hooks/useVaultApy";
import type { VaultView } from "../../types/vault";

type VaultTabKey = "vaults" | "positions";

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

  return (
    <PageContainer maxWidth="6xl" className="space-y-8">
      {/* Hero Section */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#0D1B2A] via-[#1B2838] to-[#0D1B2A] overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5" />
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
          <div className="absolute top-1/4 right-1/4 w-48 h-48 rounded-full bg-[#229EDF] blur-[80px]" />
          <div className="absolute bottom-1/4 right-1/3 w-32 h-32 rounded-full bg-[#4ADE80] blur-[60px]" />
        </div>

        <div className="relative z-10 px-6 sm:px-10 py-10 sm:py-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 mb-4">
              <VaultIcon className="h-3.5 w-3.5 text-[#4ADE80]" />
              <span className="text-white/70 text-xs font-medium">
                Yield Strategies
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">
              Automated{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#229EDF] to-[#4ADE80]">
                Vaults
              </span>
            </h1>
            <p className="text-white/60 text-base sm:text-lg leading-relaxed max-w-xl">
              Deposit assets into yield-generating vaults backed by real-world
              collateral. Earn optimized returns with automated strategies.
            </p>

            <div className="flex flex-wrap gap-4 mt-6">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <TrendingUp className="h-4 w-4 text-[#4ADE80]" />
                <span className="text-white/70 text-sm">
                  Up to{" "}
                  <span className="text-[#4ADE80] font-semibold">12% APY</span>
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                <ShieldCheck className="h-4 w-4 text-[#4ADE80]" />
                <span className="text-white/70 text-sm">
                  RWA Collateralized
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabGroup
        tabs={[
          { key: "vaults", label: "Available Vaults" },
          { key: "positions", label: "My Positions" },
        ]}
        activeTab={activeTab}
        onChange={(key) => setActiveTab(key as VaultTabKey)}
      />

      {activeTab === "vaults" ? (
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
      ) : (
        <div
          id="vault-positions-panel"
          role="tabpanel"
          aria-labelledby="vault-positions-tab"
          tabIndex={0}
          className="flex flex-col gap-6"
        >
          <MyVaultPositions />
          <VaultRunHistory />
        </div>
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
