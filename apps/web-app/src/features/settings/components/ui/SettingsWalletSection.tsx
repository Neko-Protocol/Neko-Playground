"use client";

import React from "react";
import { Unplug } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ReadonlyRow } from "@/components/ui/ReadonlyRow";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { truncateAddress } from "@/lib/utils";

export interface SettingsWalletSectionProps {
  copy: (key: string, value: string) => void;
  copiedKey: string | null;
}

export function SettingsWalletSection({
  copy,
  copiedKey,
}: SettingsWalletSectionProps) {
  const { address, walletName, isConnected, disconnect } = useStellarWallet();
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  const handleDisconnect = React.useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  }, [disconnect]);

  return (
    <SectionCard title="Wallet">
      {isConnected && address ? (
        <>
          {walletName != null && walletName !== "" && (
            <div className="flex items-center justify-between rounded-xl bg-[#2A2A2A] px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-white/40">Provider</span>
                <span className="text-sm font-medium text-white/80">
                  {walletName}
                </span>
              </div>
            </div>
          )}

          <ReadonlyRow
            label="Address"
            value={truncateAddress(address, 8, 8)}
            copyKey="address"
            copyValue={address}
            onCopy={copy}
            copiedKey={copiedKey}
            mono
          />

          <button
            type="button"
            onClick={() => void handleDisconnect()}
            disabled={isDisconnecting}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 transition-colors duration-150 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Unplug className="h-4 w-4" />
            {isDisconnecting ? "Disconnecting…" : "Disconnect Wallet"}
          </button>
        </>
      ) : (
        <div className="rounded-xl bg-[#2A2A2A] px-4 py-5 text-center">
          <p className="text-sm text-white/40">No wallet connected.</p>
          <p className="mt-0.5 text-xs text-white/25">
            Connect via the sidebar to get started.
          </p>
        </div>
      )}
    </SectionCard>
  );
}
