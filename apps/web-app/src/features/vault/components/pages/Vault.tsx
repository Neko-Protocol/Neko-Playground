"use client";

import React, { useMemo, useState } from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { VaultGrid } from "../ui/VaultGrid";
import { VaultDetailModal } from "../ui/VaultDetailModal";
import { VAULT_REGISTRY, MOCK_STATS } from "../../const/vaults";
import type { VaultView } from "../../types/vault";

const Vault: React.FC = () => {
  const [selectedVault, setSelectedVault] = useState<VaultView | null>(null);

  // Merges static config with live stats. Swap MOCK_STATS for useVaultStats() when ready.
  const vaults = useMemo<VaultView[]>(
    () =>
      Object.values(VAULT_REGISTRY).map((config) => ({
        ...config,
        ...MOCK_STATS[config.id],
      })),
    []
  );

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

      <VaultGrid vaults={vaults} onDetailsClick={setSelectedVault} />

      {selectedVault && (
        <VaultDetailModal
          vault={selectedVault}
          onClose={() => setSelectedVault(null)}
        />
      )}
    </PageContainer>
  );
};

export default Vault;
