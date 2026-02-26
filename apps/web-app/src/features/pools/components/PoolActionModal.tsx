"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { usePoolAction, useUserPosition } from "@/lib/orchestrator";
import { useWallet } from "@/hooks/useWallet";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import {
  toSmallestUnit,
  fromSmallestUnit,
} from "@/lib/helpers/tokenUtils";
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

  const maxAmount = (() => {
    if (!needsAmount) return "";
    switch (action) {
      case "deposit":
      case "supplyCollateral":
        return tokenBalance ?? "0";
      case "withdraw":
      case "withdrawCollateral":
        return position?.depositedFormatted ?? "0";
      case "repay":
        if (pool.type === "blend" && position?.metadata?.liabilities != null) {
          const raw = String(position.metadata.liabilities);
          if (raw === "0") return "0";
          return fromSmallestUnit(raw, decimals);
        }
        return "0";
      default:
        return "";
    }
  })();

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
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) return;
      const amountBigInt = BigInt(toSmallestUnit(amount, decimals));
      mutate.mutate(
        { poolId, action, amount: amountBigInt, tokenIndex: 0 },
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
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          aria-hidden
        />
        <div
          className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#334EAC]/20 overflow-hidden"
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
                {pool.type === "neko" && action === "deposit" && (
                  <p className="text-xs text-[#7096D1] bg-[#eaf4ff] rounded-lg px-3 py-2">
                    First-time deposit? You may need to approve the token first
                    from{" "}
                    <Link
                      href="/dashboard/lending"
                      className="underline font-medium"
                    >
                      Lending
                    </Link>
                    .
                  </p>
                )}
                <label className="block text-sm font-medium text-[#081F5C]">
                  Amount ({tokenCode})
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) =>
                      setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    className="flex-1 px-4 py-3 rounded-xl border border-[#334EAC]/30 bg-[#f8fafc] text-[#081F5C] focus:outline-none focus:ring-2 focus:ring-[#334EAC]/50 focus:border-[#334EAC]"
                    disabled={mutate.isPending}
                  />
                  {maxAmount !== "" && Number(maxAmount) > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(maxAmount)}
                      className="px-4 py-3 rounded-xl border border-[#334EAC]/30 bg-[#eaf4ff] text-[#334EAC] font-medium hover:bg-[#d4e8ff] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={mutate.isPending}
                    >
                      Max
                    </button>
                  )}
                </div>
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
                disabled={
                  mutate.isPending ||
                  !address ||
                  (needsAmount && (!amount || parseFloat(amount) <= 0))
                }
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
