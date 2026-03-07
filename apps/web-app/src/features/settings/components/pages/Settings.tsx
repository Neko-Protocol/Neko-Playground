"use client";

import React from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { PageContainer } from "@/components/ui/PageContainer";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { SettingsWalletSection } from "../ui/SettingsWalletSection";
import { SettingsNetworkSection } from "../ui/SettingsNetworkSection";

export default function Settings() {
  const { copy, copiedKey } = useCopyToClipboard();

  return (
    <PageContainer maxWidth="6xl">
      <BannerPage
        title="Settings"
        subtitle="Manage your wallet connection and inspect the current network configuration."
        badge="Configuration"
        imageSrc="/banners/settings.svg"
        imageAlt="Settings illustration"
        className="mb-8"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsWalletSection copy={copy} copiedKey={copiedKey} />
        <SettingsNetworkSection copy={copy} copiedKey={copiedKey} />
      </div>
    </PageContainer>
  );
}
