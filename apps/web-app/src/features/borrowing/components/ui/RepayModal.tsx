"use client";

import { useState, useMemo } from "react";
import { X, AlertTriangle } from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import type { BorrowPosition } from "../../hooks/useUserBorrowPositions";

const SCALAR_12 = 1_000_000_000_000n;
const STELLAR_DIVISOR = 10_000_000n;

function formatRaw(raw: bigint): string {
  const whole = raw / STELLAR_DIVISOR;
  const frac = raw % STELLAR_DIVISOR;
  if (frac === 0n) return whole.toLocaleString();
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${whole.toLocaleString()}.${fracStr}`;
}

interface RepayModalProps {
  position: BorrowPosition;
  /** User's wallet balance of the underlying asset (7 decimals). */
  walletBalance: bigint;
  isBalanceLoading: boolean;
  isProcessing: boolean;
  isWalletConnected: boolean;
  onClose: () => void;
  onSubmit: (dTokens: bigint) => Promise<void>;
}

export function RepayModal({
  position,
  walletBalance,
  isBalanceLoading,
  isProcessing,
  isWalletConnected,
  onClose,
  onSubmit,
}: RepayModalProps) {
  const [repayAmount, setRepayAmount] = useState("");
  const [isMaxRepay, setIsMaxRepay] = useState(false);

  // Max dTokens the wallet balance can actually cover, accounting for the
  // fact that interest accrues between query time and tx execution.
  const affordableDTokens = useMemo(() => {
    if (walletBalance <= 0n || position.dRate === 0n) return 0n;
    // Deduct 10000 stroops (0.001 USDC) as buffer for interest that accrues
    // between get_d_token_rate query time and the contract's accrue_interest
    // call at execution. Covers ~5 min drift at 10% APR for any amount.
    const safeBalance = walletBalance > 10000n ? walletBalance - 10000n : 0n;
    const d = (safeBalance * SCALAR_12) / position.dRate;
    return d > position.dTokens ? position.dTokens : d;
  }, [walletBalance, position.dRate, position.dTokens]);

  const canRepayFull = walletBalance >= position.debtRaw;

  const amountSmallest = useMemo(() => {
    if (isMaxRepay) return 0n; // handled separately
    const num = parseFloat(repayAmount);
    if (!Number.isFinite(num) || num <= 0) return 0n;
    return BigInt(Math.round(num * Number(STELLAR_DIVISOR)));
  }, [repayAmount, isMaxRepay]);

  const dTokensToRepay = useMemo(() => {
    if (isMaxRepay) return affordableDTokens;
    if (amountSmallest <= 0n) return 0n;
    if (position.dRate === 0n) return amountSmallest;
    const d = (amountSmallest * SCALAR_12) / position.dRate;
    // Cap at what the wallet can cover
    return d > affordableDTokens ? affordableDTokens : d;
  }, [isMaxRepay, amountSmallest, position.dRate, affordableDTokens]);

  const estimatedUnderlying = useMemo(() => {
    if (dTokensToRepay === 0n || position.dRate === 0n) return 0n;
    return (dTokensToRepay * position.dRate) / SCALAR_12;
  }, [dTokensToRepay, position.dRate]);

  const exceedsBalance =
    !isMaxRepay && amountSmallest > walletBalance && walletBalance > 0n;
  const exceedsDebt =
    !isMaxRepay && amountSmallest > position.debtRaw && position.debtRaw > 0n;

  const canSubmit = isWalletConnected && dTokensToRepay > 0n && !exceedsBalance;

  const handleMax = () => {
    setIsMaxRepay(true);
    // Display the affordable amount (may be less than debt if balance is low)
    const displayAmount = formatRaw(
      canRepayFull
        ? position.debtRaw
        : (affordableDTokens * position.dRate) / SCALAR_12
    ).replace(/,/g, "");
    setRepayAmount(displayAmount);
  };

  const handleAmountChange = (value: string) => {
    setIsMaxRepay(false);
    setRepayAmount(value);
  };

  const handleSubmit = async () => {
    await onSubmit(dTokensToRepay);
    setRepayAmount("");
    setIsMaxRepay(false);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate__animated animate__fadeIn animate__faster">
        <div className="bg-[#1C1C1C] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-4 sm:p-5 animate__animated animate__fadeInUp animate__faster">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white text-lg font-bold">
              Repay {position.assetCode}
            </h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors -mr-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Debt + balance info */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3">
              <p className="text-amber-400/70 text-xs">Current Debt</p>
              <p className="text-amber-400 font-bold text-sm tabular-nums">
                {position.debtFormatted}{" "}
                <span className="text-amber-400/50 font-normal text-xs">
                  {position.assetCode}
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-white/40 text-xs">Wallet Balance</p>
              {isBalanceLoading ? (
                <p className="text-white/40 text-sm">Loading…</p>
              ) : (
                <p className="text-white font-bold text-sm tabular-nums">
                  {formatRaw(walletBalance)}{" "}
                  <span className="text-white/40 font-normal text-xs">
                    {position.assetCode}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Insufficient balance warning */}
          {!isBalanceLoading && !canRepayFull && walletBalance > 0n && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-xs leading-relaxed">
                Your balance is below the full debt (interest has accrued). You
                can repay up to{" "}
                <span className="font-semibold">
                  {formatRaw((affordableDTokens * position.dRate) / SCALAR_12)}{" "}
                  {position.assetCode}
                </span>
                .
              </p>
            </div>
          )}

          {/* Amount input */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-white/60 text-xs font-medium">
                Repay Amount ({position.assetCode})
              </label>
              <button
                onClick={handleMax}
                disabled={isProcessing || isBalanceLoading}
                className="text-[#229EDF] text-xs font-semibold hover:text-[#229EDF]/80 transition-colors disabled:opacity-50"
              >
                MAX
              </button>
            </div>
            <input
              type="number"
              placeholder="0.00"
              value={repayAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              disabled={isProcessing}
              className="w-full bg-[#2A2A2A] border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-amber-500/50 transition-colors disabled:opacity-50"
            />
            {exceedsBalance && (
              <p className="text-red-400 text-xs mt-1">
                Exceeds your wallet balance
              </p>
            )}
            {exceedsDebt && !exceedsBalance && (
              <p className="text-amber-400 text-xs mt-1">
                Exceeds current debt — will repay in full
              </p>
            )}
          </div>

          {/* Estimated cost */}
          {dTokensToRepay > 0n && (
            <div className="mb-4 rounded-xl bg-white/5 border border-white/5 px-3 py-2">
              <p className="text-white/40 text-xs">
                Estimated cost:{" "}
                <span className="text-white font-medium tabular-nums">
                  {formatRaw(estimatedUnderlying)} {position.assetCode}
                </span>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-white/60 font-semibold text-sm hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={isProcessing || !canSubmit || isBalanceLoading}
              className="flex-1 rounded-xl bg-amber-500 py-2.5 text-white font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing
                ? "Processing…"
                : !isWalletConnected
                  ? "Connect Wallet"
                  : "Repay"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
