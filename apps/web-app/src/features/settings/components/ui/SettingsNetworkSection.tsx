"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ReadonlyRow } from "@/components/ui/ReadonlyRow";
import {
  network,
  rpcUrl,
  horizonUrl,
  networkPassphrase,
  labPrefix,
} from "@/lib/constants/network";
import { NETWORK_BADGE } from "@/lib/constants/networkDisplay";

export interface SettingsNetworkSectionProps {
  copy: (key: string, value: string) => void;
  copiedKey: string | null;
}

export function SettingsNetworkSection({
  copy,
  copiedKey,
}: SettingsNetworkSectionProps) {
  const badge = NETWORK_BADGE[network.id] ?? NETWORK_BADGE.custom;

  return (
    <SectionCard title="Network">
      <div className="flex items-center justify-between rounded-xl bg-[#2A2A2A] px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-white/40">Active Network</span>
          <span className="text-sm font-medium text-white/80">Stellar</span>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.text} ${badge.border} bg-white/5`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          {badge.label}
        </span>
      </div>

      <ReadonlyRow
        label="RPC URL"
        value={rpcUrl}
        copyKey="rpc"
        onCopy={copy}
        copiedKey={copiedKey}
      />

      <ReadonlyRow
        label="Horizon URL"
        value={horizonUrl}
        copyKey="horizon"
        onCopy={copy}
        copiedKey={copiedKey}
      />

      <ReadonlyRow
        label="Network Passphrase"
        value={networkPassphrase}
        copyKey="passphrase"
        onCopy={copy}
        copiedKey={copiedKey}
      />

      <a
        href={labPrefix()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/60 transition-colors duration-150 hover:bg-white/10 hover:text-white/90"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        Open Stellar Lab
      </a>
    </SectionCard>
  );
}
