"use client";

import React, { useState } from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { VaultGrid } from "../ui/VaultGrid";
import { VaultDetailModal } from "../ui/VaultDetailModal";
import { MOCK_VAULTS } from "../../const/vaults";
import type { VaultData } from "../../types/vault";

const Vault: React.FC = () => {
  const [selectedVault, setSelectedVault] = useState<VaultData | null>(null);

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

      <VaultGrid vaults={MOCK_VAULTS} onDetailsClick={setSelectedVault} />

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
