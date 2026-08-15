"use client";

import React, { useTransition } from "react";
import { X, Coins, AlertCircle } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { useToast } from "@/hooks/useToast";
import { useWallet } from "@/hooks/useWallet";
import { useSorobanTokenBalances } from "@/hooks/useSorobanTokenBalances";
import {
  buildFaucetTransaction,
  getFaucetTokens,
} from "@/lib/constants/faucet";
import { stellarNetwork } from "@/lib/constants/network";
import { addFaucetTokensToFreighter } from "@/lib/helpers/stellar/freighter";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import {
  rpcUrl,
  networkPassphrase,
  horizonUrl,
} from "@/lib/constants/network";

export interface GetTestTokensModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function isMissing(balance: string): boolean {
  const n = parseFloat(balance);
  return Number.isNaN(n) || n <= 0;
}

export function GetTestTokensModal({
  isOpen,
  onClose,
}: GetTestTokensModalProps) {
  const { address, signTransaction } = useWallet();
  const { addNotification } = useToast();
  const { balances, isFetching, invalidate } = useSorobanTokenBalances();
  const [isMinting, startMintTransition] = useTransition();

  if (stellarNetwork === "PUBLIC") return null;
  if (!isOpen) return null;

  const missingTokens = balances.filter((t) => isMissing(t.balance));
  const hasMissing = missingTokens.length > 0;

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

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate__animated animate__fadeIn animate__faster">
        <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl p-4 sm:p-5 animate__animated animate__fadeInUp animate__faster">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins className="h-6 w-6 text-emerald-400" />
              <h3 className="text-white text-lg font-bold">Get Test Tokens</h3>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors -mr-1"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {hasMissing && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-200 text-sm font-medium">
                  You&apos;re missing {missingTokens.length} token
                  {missingTokens.length > 1 ? "s" : ""}
                </p>
                <p className="text-amber-200/70 text-xs mt-0.5">
                  Mint USTRY, TESOURO, CETES, USDY, PYUSD & KTB to use Borrow,
                  Lend and Pools.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl bg-[#2A2A2A] px-4 py-3 mb-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-white/40">
                RWA Token Balances
              </span>
              {isFetching && (
                <span className="text-[10px] text-white/20">updating…</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {balances.map((t) => {
                const missing = isMissing(t.balance);
                return (
                  <div
                    key={t.contractId}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                      missing ? "bg-red-500/10" : "bg-white/5"
                    }`}
                  >
                    <span
                      className={`text-sm ${
                        missing ? "text-red-300" : "text-white/70"
                      }`}
                    >
                      {t.symbol}
                      {missing && (
                        <span className="ml-1.5 text-[10px] text-red-400/80">
                          (empty)
                        </span>
                      )}
                    </span>
                    <span
                      className={`font-mono text-sm ${
                        missing ? "text-red-300" : "text-white/90"
                      }`}
                    >
                      {t.balance}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleMintTestTokens}
            disabled={isMinting}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition-colors duration-150 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Coins className="h-4 w-4" />
            {isMinting
              ? "Minting tokens…"
              : "Get Test Tokens (USTRY, CETES, USDY…)"}
          </button>

          <p className="mt-3 text-[10px] text-white/30 text-center">
            Tokens are minted from the faucet and added to your wallet.
          </p>
        </div>
      </div>
    </ModalPortal>
  );
}
