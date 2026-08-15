"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { useVaultBalance } from "../../hooks/useVaultBalance";
import { useVaultAction } from "../../hooks/useVaultAction";
import { useWallet } from "@/hooks/useWallet";
import { sanitizeAmountInput } from "@/lib/helpers/tokenUtils";
import { useQuery } from "@tanstack/react-query";
import { getTokenBalanceFromContract } from "@/lib/helpers/stellar/sorobanBalance";

import { getAssetsConfig } from "@/lib/constants/assets.config";

const CETES_CONTRACT = getAssetsConfig().CETES.contract;

interface VaultActionModalProps {
  isDeposit: boolean;
  onClose: () => void;
}

export function VaultActionModal({
  isDeposit,
  onClose,
}: VaultActionModalProps) {
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"deposit" | "withdraw">(
    isDeposit ? "deposit" : "withdraw"
  );

  const { address } = useWallet();
  const { sharesFormatted, userShares } = useVaultBalance();
  const { isLoading, handleDeposit, handleWithdraw } = useVaultAction();

  const { data: cetesBalance = "0" } = useQuery({
    queryKey: ["cetesBalance", address],
    queryFn: () => getTokenBalanceFromContract(CETES_CONTRACT, address!, 7),
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 220);
  }, [onClose]);

  const maxAmount = mode === "deposit" ? String(cetesBalance) : sharesFormatted;

  const handleMax = () => {
    setAmount(maxAmount);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(sanitizeAmountInput(e.target.value));
  };

  const handleConfirm = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (mode === "deposit") {
      await handleDeposit(amount);
    } else {
      await handleWithdraw(amount);
    }
    handleClose();
  };

  const isDisabled = isLoading || !amount || parseFloat(amount) <= 0;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200"
        style={{
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(4px)",
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      >
        <div
          className="relative w-full max-w-md flex flex-col rounded-2xl overflow-hidden transition-all duration-200"
          style={{
            background: "#141414",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
            opacity: visible ? 1 : 0,
            transform: visible
              ? "translateY(0) scale(1)"
              : "translateY(12px) scale(0.97)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            aria-label="Close modal"
            onClick={handleClose}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header with toggle */}
          <div className="px-5 pt-5 pb-4 border-b border-white/5 flex justify-center">
            <div className="flex bg-[#2A2A2A] rounded-xl p-1 gap-1 w-full max-w-xs">
              <button
                onClick={() => {
                  setMode("deposit");
                  setAmount("");
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "deposit"
                    ? "bg-[#229EDF] text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                Deposit
              </button>
              <button
                onClick={() => {
                  setMode("withdraw");
                  setAmount("");
                }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "withdraw"
                    ? "bg-[#229EDF] text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                Withdraw
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-5 space-y-4">
            {/* Balance info */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">
                {mode === "deposit" ? "CETES Balance" : "dfTokens Balance"}
              </span>
              <span className="text-white/60 font-mono">
                {mode === "deposit" ? cetesBalance : sharesFormatted}
              </span>
            </div>

            {/* Amount input */}
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={handleAmountChange}
                className="flex-1 bg-transparent text-white text-lg font-medium outline-none placeholder:text-white/20"
              />
              <button
                onClick={handleMax}
                className="px-2 py-1 rounded-md text-xs font-semibold text-[#229EDF] hover:bg-[#229EDF]/10 transition-colors"
              >
                Max
              </button>
            </div>

            {/* Info rows */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-white/40">Slippage tolerance</span>
                <span className="text-white/60">1%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Network</span>
                <span className="text-white/60">Stellar Testnet</span>
              </div>
              {mode === "deposit" && (
                <div className="flex justify-between">
                  <span className="text-white/40">Auto-invest</span>
                  <span className="text-white/60">Yes</span>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="px-5 py-4 border-t border-white/5">
            <button
              onClick={handleConfirm}
              disabled={isDisabled}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-colors duration-200 bg-[#229EDF] hover:bg-[#1a8bc7] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading
                ? "Processing..."
                : mode === "deposit"
                  ? "Deposit CETES"
                  : "Withdraw"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
