"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePoolAction, useUserPosition } from "@/lib/orchestrator";
import { useWallet } from "@/hooks/useWallet";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { toSmallestUnit, fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { AmountInput } from "@/components/AmountInput";
import type { PoolInfo, PoolAction } from "@/lib/orchestrator";

interface PoolActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: PoolInfo;
  poolId: string;
  action: PoolAction;
}

const ACTION_LABELS: Record<PoolAction, string> = {
  deposit: "Deposit",
  withdraw: "Withdraw",
  borrow: "Borrow",
  repay: "Repay",
  claimRewards: "Claim Rewards",
  supplyCollateral: "Supply Collateral",
  withdrawCollateral: "Withdraw Collateral",
};

/** What the ceiling for each action represents, for the over-max message. */
const MAX_SOURCE_LABELS: Record<PoolAction, string> = {
  deposit: "your wallet balance",
  supplyCollateral: "your wallet balance",
  withdraw: "your supplied balance",
  withdrawCollateral: "your withdrawable collateral",
  borrow: "your borrow capacity",
  repay: "your outstanding debt",
  claimRewards: "",
};

/** Smallest of the defined operands; `undefined` means "no ceiling here". */
function minUnits(...values: (bigint | undefined)[]): bigint | undefined {
  let min: bigint | undefined;
  for (const value of values) {
    if (value === undefined) continue;
    if (min === undefined || value < min) min = value;
  }
  return min;
}

export function PoolActionModal({
  isOpen,
  onClose,
  pool,
  poolId,
  action,
}: PoolActionModalProps) {
  const [amount, setAmount] = useState("");
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const mutate = usePoolAction();
  const { data: position } = useUserPosition(poolId, address);
  const { balance: tokenBalance } = useTokenBalance(pool.tokens[0]?.address);

  const token = pool.tokens[0];
  const decimals = token?.decimals ?? 7;
  const tokenCode = token?.code ?? "Token";
  const needsAmount = action !== "claimRewards";

  const walletUnits =
    tokenBalance != null ? toSmallestUnit(tokenBalance, decimals) : undefined;

  /**
   * Ceiling for this action in smallest units, or `undefined` when no ceiling
   * is known — the adapter reports a per-action limit because each request
   * moves one specific balance, so withdraw and withdrawCollateral never share
   * a max even on the same reserve.
   */
  const maxUnits = (() => {
    if (!needsAmount) return undefined;
    switch (action) {
      case "deposit":
      case "supplyCollateral":
        return walletUnits;
      case "repay":
        // Bounded by the debt and by what the wallet can actually pay.
        return minUnits(position?.limits?.repay, walletUnits);
      default:
        return position?.limits?.[action];
    }
  })();

  const maxAmount =
    maxUnits !== undefined
      ? fromSmallestUnit(maxUnits.toString(), decimals)
      : "";

  const amountUnits = amount.trim() ? toSmallestUnit(amount, decimals) : 0n;
  const isPositive = amountUnits > 0n;
  const exceedsMax =
    isPositive && maxUnits !== undefined && amountUnits > maxUnits;

  // Only the over-max case gets a message. A blank or still-being-typed amount
  // just leaves the button disabled, so "0." does not flash an error mid-entry.
  const validationError =
    needsAmount && exceedsMax
      ? `Amount exceeds ${MAX_SOURCE_LABELS[action]} (max ${maxAmount} ${tokenCode}).`
      : null;

  const canSubmit = needsAmount ? isPositive && !exceedsMax : true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    const onSuccess = async () => {
      setAmount("");
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: ["orchestrator", "pool", poolId],
        }),
        queryClient.refetchQueries({
          queryKey: ["orchestrator", "position", poolId],
        }),
        address
          ? queryClient.refetchQueries({ queryKey: ["balances", address] })
          : Promise.resolve(),
        queryClient.refetchQueries({ queryKey: ["tokenBalance"] }),
      ]);
      onClose();
    };

    if (needsAmount) {
      // Same guard the submit button uses — an over-max amount never reaches
      // the wallet or a doomed simulation.
      if (!canSubmit) return;
      mutate.mutate(
        { poolId, action, amount: amountUnits, tokenIndex: 0 },
        { onSuccess }
      );
    } else {
      mutate.mutate({ poolId, action, amount: 0n }, { onSuccess });
    }
  };

  const handleClose = () => {
    if (!mutate.isPending) {
      setAmount("");
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 animate__animated animate__fadeIn animate__faster"
        onClick={handleClose}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          aria-hidden
        />
        <div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#334EAC]/20 overflow-hidden animate__animated animate__fadeInUp animate__faster"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-[#334EAC]/20">
            <h2 className="text-xl font-bold text-[#081F5C]">
              {ACTION_LABELS[action]} — {pool.name || tokenCode}
            </h2>
            <button
              onClick={handleClose}
              disabled={mutate.isPending}
              className="text-[#7096D1] hover:text-[#081F5C] p-1.5 rounded-lg hover:bg-[#eaf4ff] transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 5L5 15M5 5l10 10" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            {!address ? (
              <p className="text-[#7096D1] text-center py-4">
                Connect your wallet to continue.
              </p>
            ) : needsAmount ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-[#081F5C]">
                  Amount ({tokenCode})
                </label>
                <div className="flex gap-2">
                  <AmountInput
                    value={amount}
                    onChange={setAmount}
                    decimals={decimals}
                    disabled={mutate.isPending}
                    className="flex-1 px-4 py-3 rounded-xl border border-[#334EAC]/30 bg-[#f8fafc] text-[#081F5C] focus:outline-none focus:ring-2 focus:ring-[#334EAC]/50 focus:border-[#334EAC]"
                  />
                  {maxUnits !== undefined && maxUnits > 0n && (
                    <button
                      type="button"
                      onClick={() => setAmount(maxAmount)}
                      disabled={mutate.isPending}
                      className="px-4 py-3 rounded-xl border border-[#334EAC]/30 bg-[#eaf4ff] text-[#334EAC] font-medium hover:bg-[#d4e8ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Max
                    </button>
                  )}
                </div>
                {maxUnits !== undefined && (
                  <p className="text-xs text-[#7096D1]">
                    Max {maxAmount} {tokenCode} &middot;{" "}
                    {MAX_SOURCE_LABELS[action]}
                  </p>
                )}
                {validationError && (
                  <p role="alert" className="text-xs font-medium text-red-600">
                    {validationError}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[#7096D1] text-center py-2">
                Claim all available rewards from this pool.
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={handleClose}
                disabled={mutate.isPending}
                className="flex-1 px-4 py-3 rounded-xl border border-[#334EAC]/30 text-[#334EAC] font-semibold hover:bg-[#eaf4ff] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutate.isPending || !address || !canSubmit}
                className="flex-1 px-4 py-3 rounded-xl bg-[#334EAC] text-white font-semibold hover:bg-[#294cab] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {mutate.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    Processing...
                  </span>
                ) : (
                  ACTION_LABELS[action]
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
