import { AmountInput } from "@/components/AmountInput";
"use client";

import { useState } from "react";
import { BackstopInfoAlert } from "./BackstopInfoAlert";
import { QueueCountdown } from "./QueueCountdown";

type ActionTab = "deposit" | "withdraw";

interface BackstopActionPanelProps {
  isLoading: boolean;
  walletBalance: string;
  depositedAmount: string;
  activeDepositAmount: string;
  queuedDepositAmount: string;
  hasWallet: boolean;
  backstopTokenConfigured: boolean;
  inWithdrawalQueue: boolean;
  queueExpired: boolean;
  queueExpiresAt: Date | null;
  onDeposit: (amount: string) => Promise<void>;
  onInitiateWithdrawal: (amount: string) => Promise<void>;
  onWithdraw: (amount: string) => Promise<void>;
}

export function BackstopActionPanel({
  isLoading,
  walletBalance,
  depositedAmount,
  activeDepositAmount,
  queuedDepositAmount,
  hasWallet,
  backstopTokenConfigured,
  inWithdrawalQueue,
  queueExpired,
  queueExpiresAt,
  onDeposit,
  onInitiateWithdrawal,
  onWithdraw,
}: BackstopActionPanelProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>("deposit");
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const hasDeposit = parseFloat(depositedAmount) > 0;
  const hasActiveDeposit = parseFloat(activeDepositAmount) > 0;

  const canDeposit =
    hasWallet &&
    backstopTokenConfigured &&
    !!depositAmount &&
    parseFloat(depositAmount) > 0 &&
    !isLoading;

  const canQueue =
    hasWallet &&
    hasActiveDeposit &&
    !!withdrawAmount &&
    parseFloat(withdrawAmount) > 0 &&
    !isLoading;

  const canWithdraw =
    hasWallet && inWithdrawalQueue && queueExpired && !isLoading;

  return (
    <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-5">
      <p className="text-white/40 text-xs font-semibold uppercase tracking-wide">
        Actions
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-[#242424] p-1">
        <button
          onClick={() => setActiveTab("deposit")}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === "deposit"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Deposit
        </button>
        <button
          onClick={() => setActiveTab("withdraw")}
          disabled={!hasDeposit}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === "withdraw"
              ? "bg-[#229EDF] text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          Withdraw
        </button>
      </div>

      {/* Deposit */}
      {activeTab === "deposit" && (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/50 text-sm font-medium">Amount</span>
              {parseFloat(walletBalance) > 0 && (
                <button
                  onClick={() => setDepositAmount(walletBalance)}
                  disabled={isLoading}
                  className="text-[#229EDF] text-xs font-semibold hover:text-[#229EDF]/70 transition-colors disabled:opacity-40 shrink-0 ml-2"
                >
                  Max: {parseFloat(walletBalance).toFixed(4)}
                </button>
              )}
            </div>
            <div className="bg-[#2A2A2A] rounded-xl px-4 h-14 flex items-center">
              <AmountInput
                value={depositAmount}
                onChange={setDepositAmount}
                disabled={isLoading || !backstopTokenConfigured}
                className="bg-transparent text-white text-2xl font-bold w-full outline-none placeholder:text-white/30 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="bg-[#252525] rounded-xl p-3.5">
            <p className="text-white/40 text-xs">Available in wallet</p>
            <p className="text-white font-bold text-sm mt-0.5">
              {walletBalance}
            </p>
          </div>

          {!backstopTokenConfigured && (
            <BackstopInfoAlert variant="warning">
              Backstop token is not yet configured for this pool.
            </BackstopInfoAlert>
          )}

          <button
            onClick={() =>
              void onDeposit(depositAmount).then(() => setDepositAmount(""))
            }
            disabled={!canDeposit}
            className="w-full rounded-xl bg-[#229EDF] py-3 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading
              ? "Processing…"
              : !hasWallet
                ? "Connect Wallet"
                : "Deposit to Backstop"}
          </button>
        </div>
      )}

      {/* Withdraw */}
      {activeTab === "withdraw" && (
        <div className="flex flex-col gap-4">
          {hasActiveDeposit && (
            <>
              <BackstopInfoAlert variant="warning">
                To withdraw, you must first queue your withdrawal and wait{" "}
                {inWithdrawalQueue && queueExpiresAt ? (
                  <QueueCountdown expiresAt={queueExpiresAt} />
                ) : (
                  <span className="font-semibold text-amber-400">17 days</span>
                )}
                .
              </BackstopInfoAlert>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white/50 text-sm font-medium">
                    Amount to queue
                  </span>
                  {parseFloat(activeDepositAmount) > 0 && (
                    <button
                      onClick={() => setWithdrawAmount(activeDepositAmount)}
                      disabled={isLoading}
                      className="text-[#229EDF] text-xs font-semibold hover:text-[#229EDF]/70 transition-colors disabled:opacity-40"
                    >
                      Max: {parseFloat(activeDepositAmount).toFixed(4)}
                    </button>
                  )}
                </div>
                <div className="bg-[#2A2A2A] rounded-xl px-4 h-14 flex items-center">
                  <AmountInput
                    value={withdrawAmount}
                    onChange={setWithdrawAmount}
                    disabled={isLoading}
                    className="bg-transparent text-white text-2xl font-bold w-full outline-none placeholder:text-white/30 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="bg-[#252525] rounded-xl p-3.5">
                <p className="text-white/40 text-xs">Available to queue</p>
                <p className="text-white font-bold text-sm mt-0.5">
                  {activeDepositAmount}
                </p>
              </div>

              <button
                onClick={() =>
                  void onInitiateWithdrawal(withdrawAmount).then(() =>
                    setWithdrawAmount("")
                  )
                }
                disabled={!canQueue}
                className="w-full rounded-xl border border-amber-500/40 py-3 text-amber-400 font-semibold text-sm hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Processing…" : "Queue Withdrawal (17-day wait)"}
              </button>
            </>
          )}

          {inWithdrawalQueue && (
            <>
              {hasActiveDeposit && (
                <div className="border-t border-white/5 my-1" />
              )}

              <div className="bg-[#252525] rounded-xl p-3.5">
                <p className="text-white/40 text-xs">Amount queued</p>
                <p className="text-white font-bold text-sm mt-0.5">
                  {queuedDepositAmount}
                </p>
              </div>

              <button
                onClick={() =>
                  void onWithdraw(queuedDepositAmount).then(() =>
                    setWithdrawAmount("")
                  )
                }
                disabled={!canWithdraw}
                className="w-full rounded-xl bg-[#229EDF] py-3 text-white font-semibold text-sm hover:bg-[#1a8bc7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? "Processing…"
                  : queueExpired
                    ? "Confirm Withdraw"
                    : "Waiting for queue to expire…"}
              </button>
            </>
          )}

          {!hasActiveDeposit && !inWithdrawalQueue && (
            <BackstopInfoAlert variant="info">
              No active deposit to withdraw.
            </BackstopInfoAlert>
          )}
        </div>
      )}
    </div>
  );
}