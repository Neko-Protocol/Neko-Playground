"use client";

import React, { useTransition } from "react";
import { Unplug, Coins, Wallet } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ReadonlyRow } from "@/components/ui/ReadonlyRow";
import { useStellarWallet } from "@/hooks/useStellarWallet";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { useSorobanTokenBalances } from "@/hooks/useSorobanTokenBalances";
import { truncateAddress } from "@/lib/utils";
import { stellarNetwork } from "@/lib/constants/network";
import {
  buildFaucetTransaction,
  getFaucetTokens,
} from "@/lib/constants/faucet";
import { addFaucetTokensToFreighter } from "@/lib/helpers/stellar/freighter";
import { addToken as freighterAddToken } from "@stellar/freighter-api";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
} from "@/lib/constants/network";

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
  const { addNotification } = useToast();
  const {
    balances,
    isFetching: isFetchingBalances,
    invalidate,
  } = useSorobanTokenBalances();
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

        await invalidate();

        try {
          addNotification("Adding tokens to Freighter…", "info");
          await addFaucetTokensToFreighter(networkPassphrase);
          addNotification("Tokens added to Freighter", "success");
        } catch {
          addNotification(
            "Mint succeeded but adding to Freighter failed. Use the wallet icon per token to add manually.",
            "warning"
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        addNotification(`Failed to mint test tokens: ${msg}`, "error");
      }
    });
  };

  const handleAddToFreighter = async (contractId: string, symbol: string) => {
    try {
      const result = await freighterAddToken({
        contractId,
        networkPassphrase,
      });
      if (result.contractId && !result.error) {
        addNotification(`${symbol} added to Freighter`, "success");
      }
    } catch {
      addNotification(`Failed to add ${symbol} to Freighter`, "error");
    }
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

          {stellarNetwork !== "PUBLIC" && balances.length > 0 && (
            <div className="rounded-xl bg-[#2A2A2A] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-white/40">
                  RWA Token Balances
                </span>
                {isFetchingBalances && (
                  <span className="text-[10px] text-white/20">updating…</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {balances.map((t) => (
                  <div
                    key={t.contractId}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-white/70">{t.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-white/90">
                        {t.balance}
                      </span>
                      <button
                        type="button"
                        title={`Add ${t.symbol} to Freighter`}
                        onClick={() =>
                          void handleAddToFreighter(t.contractId, t.symbol)
                        }
                        className="rounded p-0.5 text-white/20 transition-colors hover:text-white/60"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
