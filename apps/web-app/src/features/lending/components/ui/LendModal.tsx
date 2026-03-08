"use client";

import { useState, useMemo } from "react";
import { X, RefreshCw } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { PoolData } from "../../types/lending";

interface LendModalProps {
  pool: PoolData;
  isDeposit: boolean;
  isLoading: boolean;
  bTokenBalance: string | null;
  isLoadingBalance: boolean;
  hasWallet: boolean;
  onClose: () => void;
  onConfirm: (amount: string) => Promise<void>;
  onRefreshBalance: () => void;
}

export function LendModal({
  pool,
  isDeposit,
  isLoading,
  bTokenBalance,
  isLoadingBalance,
  hasWallet,
  onClose,
  onConfirm,
  onRefreshBalance,
}: LendModalProps) {
  const [amount, setAmount] = useState("");

  const bTokensToBurn = useMemo(() => {
    if (
      !amount ||
      parseFloat(amount) <= 0 ||
      !pool.bTokenRate ||
      parseFloat(pool.bTokenRate) <= 0
    )
      return null;
    return (parseFloat(amount) / parseFloat(pool.bTokenRate)).toFixed(7);
  }, [amount, pool.bTokenRate]);

  const canSubmit =
    hasWallet &&
    !!amount &&
    parseFloat(amount) > 0 &&
    (isDeposit ||
      (!!bTokensToBurn &&
        parseFloat(bTokensToBurn) > 0 &&
        (bTokenBalance === null ||
          parseFloat(bTokensToBurn) <= parseFloat(bTokenBalance))));

  const stats = [
    { label: "Supply APY", value: pool.roi },
    { label: "Liquidity", value: pool.liquidity },
    {
      label: "bToken Rate",
      value: pool.bTokenRate
        ? parseFloat(pool.bTokenRate).toFixed(4)
        : "1.0000",
    },
  ];

  const modalContent = (
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate__animated animate__fadeIn animate__faster">
      <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl p-4 sm:p-5 animate__animated animate__fadeInUp animate__faster">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white text-lg font-bold">
            {isDeposit ? "Deposit" : "Withdraw"} — {pool.name}
          </h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors -mr-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white/5 rounded-lg p-2.5">
              <p className="text-white/40 text-[10px] sm:text-xs mb-0.5">
                {label}
              </p>
              <p className="text-white font-semibold text-xs sm:text-sm truncate">
                {value}
              </p>
            </div>
          ))}
        </div>

        {!isDeposit && (
          <div className="mb-3 rounded-xl bg-[#229EDF]/10 border border-[#229EDF]/20 p-3 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-[#229EDF]/70 text-xs">Your bToken Balance</p>
              <p className="text-[#229EDF] font-bold text-base truncate">
                {isLoadingBalance ? "Loading…" : (bTokenBalance ?? "--")} b
                {pool.token1}
              </p>
            </div>
            <button
              onClick={onRefreshBalance}
              disabled={isLoadingBalance}
              className="text-[#229EDF]/60 hover:text-[#229EDF] transition-colors disabled:opacity-40 shrink-0 ml-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoadingBalance ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        )}

        <div className="mb-3">
          <label className="text-white/60 text-xs font-medium block mb-1">
            {isDeposit ? "Amount to Deposit" : "Amount to Withdraw"} (
            {pool.token1})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#2A2A2A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
          />
          {!isDeposit && amount && bTokensToBurn && (
            <p className="text-white/30 text-xs mt-1 italic">
              You will burn ~{parseFloat(bTokensToBurn).toFixed(4)} bTokens
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-white/10 py-2.5 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm(amount)}
            disabled={isLoading || !canSubmit}
            className="flex-1 rounded-xl bg-[#229EDF] py-2.5 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "Processing…"
              : !hasWallet
                ? "Connect Wallet"
                : isDeposit
                  ? "Confirm Deposit"
                  : "Confirm Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );

  return <ModalPortal>{modalContent}</ModalPortal>;
}
