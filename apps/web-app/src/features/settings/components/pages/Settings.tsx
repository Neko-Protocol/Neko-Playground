"use client";

import React from "react";
import { BannerPage } from "@/components/ui/BannerPage";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { SettingsWalletSection } from "../ui/SettingsWalletSection";
import { SettingsNetworkSection } from "../ui/SettingsNetworkSection";

export default function Settings() {
  const { copy, copiedKey } = useCopyToClipboard();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      <BannerPage
        title="Settings"
        subtitle="Manage your wallet connection and inspect the current network configuration."
        badge="Configuration"
        className="mb-6"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SettingsWalletSection copy={copy} copiedKey={copiedKey} />
        <SettingsNetworkSection copy={copy} copiedKey={copiedKey} />
      </div>
    </div>
  );
}
