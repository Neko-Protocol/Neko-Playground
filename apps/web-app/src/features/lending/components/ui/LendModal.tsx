"use client";

import { useState, useMemo } from "react";
import { X, RefreshCw } from "lucide-react";
import type { PoolData } from "../../types/lending";

interface LendModalProps {
  pool: PoolData;
  isDeposit: boolean;
  isLoading: boolean;
  error: string | null;
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
  error,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1C1C1C] border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white text-xl font-bold">
            {isDeposit ? "Deposit" : "Withdraw"} — {pool.name}
          </h3>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {stats.map(({ label, value }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3">
              <p className="text-white/40 text-xs mb-0.5">{label}</p>
              <p className="text-white font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>

        {!isDeposit && (
          <div className="mb-5 rounded-2xl bg-[#229EDF]/10 border border-[#229EDF]/20 p-4 flex items-center justify-between">
            <div>
              <p className="text-[#229EDF]/70 text-xs">Your bToken Balance</p>
              <p className="text-[#229EDF] font-bold text-lg">
                {isLoadingBalance ? "Loading…" : (bTokenBalance ?? "--")} b
                {pool.token1}
              </p>
            </div>
            <button
              onClick={onRefreshBalance}
              disabled={isLoadingBalance}
              className="text-[#229EDF]/60 hover:text-[#229EDF] transition-colors disabled:opacity-40"
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoadingBalance ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        )}

        <div className="mb-5">
          <label className="text-white/60 text-sm font-medium block mb-1.5">
            {isDeposit ? "Amount to Deposit" : "Amount to Withdraw"} (
            {pool.token1})
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={isLoading}
            className="w-full bg-[#2A2A2A] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 outline-none focus:border-[#229EDF]/50 transition-colors disabled:opacity-50"
          />
          {!isDeposit && amount && bTokensToBurn && (
            <p className="text-white/30 text-xs mt-1 italic">
              You will burn ~{parseFloat(bTokensToBurn).toFixed(4)} bTokens
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 rounded-xl border border-white/10 py-3 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm(amount)}
            disabled={isLoading || !canSubmit}
            className="flex-1 rounded-xl bg-[#229EDF] py-3 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
}
