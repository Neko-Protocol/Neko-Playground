"use client";

import React, { useTransition } from "react";
import { Unplug, Coins } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ReadonlyRow } from "@/components/ui/ReadonlyRow";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useWallet } from "@/hooks/useWallet";
import { useNotification } from "@/hooks/useNotification";
import { truncateAddress } from "@/lib/utils";
import { stellarNetwork } from "@/lib/constants/network";
import {
  buildFaucetTransaction,
  getFaucetTokens,
  addFaucetTokensToWallet,
} from "@/lib/constants/faucet";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
} from "@/lib/config/stellar.config";

export interface SettingsWalletSectionProps {
  copy: (key: string, value: string) => void;
  copiedKey: string | null;
}

export function SettingsWalletSection({
  copy,
  copiedKey,
}: SettingsWalletSectionProps) {
  const { address, walletName, isConnected, disconnect } = useStellarWallet();
  const { signTransaction } = useWallet();
  const { addNotification } = useNotification();
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);
  const [isMinting, startMintTransition] = useTransition();

  const handleDisconnect = React.useCallback(async () => {
    setIsDisconnecting(true);
    try {
      await disconnect();
    } finally {
      setIsDisconnecting(false);
    }
  }, [disconnect]);

  const handleMintTestTokens = () => {
    if (!address) return;
    startMintTransition(async () => {
      try {
        const txXdr = await buildFaucetTransaction(
          address,
          rpcUrl,
          horizonUrl,
          networkPassphrase
        );

        await signAndSendTransaction(txXdr, signTransaction, {
          networkPassphrase,
          rpcUrl,
          address,
        });

        const tokens = getFaucetTokens();
        addNotification(
          `Minted: ${tokens.map((t) => t.symbol).join(", ")}`,
          "success"
        );

        const added = await addFaucetTokensToWallet(networkPassphrase);
        if (added.length > 0) {
          addNotification(`Added to wallet: ${added.join(", ")}`, "success");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        addNotification(`Failed to mint test tokens: ${msg}`, "error");
      }
    });
  };

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

          {stellarNetwork !== "PUBLIC" && (
            <button
              type="button"
              onClick={handleMintTestTokens}
              disabled={isMinting}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition-colors duration-150 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Coins className="h-4 w-4" />
              {isMinting
                ? "Minting tokens…"
                : "Get Test Tokens (USTRY, CETES, USDY…)"}
            </button>
          )}

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
