"use client";

import { useState } from "react";
import { Shield, RefreshCw } from "lucide-react";
import { useBackstop } from "@/features/backstop/hooks/useBackstop";
import { networks as backstopNetworks } from "@neko/backstop";
import { BackstopQueueStatus } from "@/features/backstop/components/ui/BackstopQueueStatus";
import { BackstopActionPanel } from "@/features/backstop/components/ui/BackstopActionPanel";
import { BackstopInfoAlert } from "@/features/backstop/components/ui/BackstopInfoAlert";

const POOLS = [
  {
    label: "Crypto Pool",
    contractId: backstopNetworks.testnet.pool1ContractId,
    assets: "USDC · XLM",
  },
  {
    label: "RWA Pool",
    contractId: backstopNetworks.testnet.pool2ContractId,
    assets: "USTRY · CETES · USDY · PYUSD · KTB",
  },
];

export function BackstopPanel() {
  const [selectedPoolIndex, setSelectedPoolIndex] = useState(0);
  const selectedPool = POOLS[selectedPoolIndex]!;

  const {
    isLoading,
    walletBalance,
    isLoadingWalletBalance,
    depositedAmount,
    activeDepositAmount,
    queuedDepositAmount,
    isLoadingDeposit,
    inWithdrawalQueue,
    queueExpiresAt,
    queueExpired,
    backstopTokenConfigured,
    hasWallet,
    handleDeposit,
    handleInitiateWithdrawal,
    handleWithdraw,
    refetchAll,
  } = useBackstop(selectedPool.contractId);

  return (
    <div className="w-full space-y-4">
      {/* Pool selector */}
      <div className="flex gap-2">
        {POOLS.map((pool, i) => {
          const isSelected = selectedPoolIndex === i;
          return (
            <button
              key={pool.contractId}
              onClick={() => setSelectedPoolIndex(i)}
              className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${
                isSelected
                  ? "border-[#229EDF]/50 bg-[#229EDF]/10"
                  : "border-white/10 bg-[#1C1C1C] hover:border-white/20"
              }`}
            >
              <p
                className={`text-sm font-semibold leading-none ${
                  isSelected ? "text-[#229EDF]" : "text-white/60"
                }`}
              >
                {pool.label}
              </p>
              <p className="text-white/30 text-xs mt-1">{pool.assets}</p>
            </button>
          );
        })}
      </div>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: info + position */}
        <div className="bg-[#1C1C1C] rounded-[20px] p-5 flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#229EDF]/15 flex items-center justify-center shrink-0">
              <Shield className="h-5 w-5 text-[#229EDF]" />
            </div>
            <div className="min-w-0">
              <p className="text-white font-bold text-base">Backstop Module</p>
              <p className="text-white/40 text-sm mt-0.5">
                Provide first-loss capital to protect the protocol.
              </p>
            </div>
          </div>

          <div className="border-t border-white/5" />

          {/* Position stats */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wide mb-3">
              Your Position
            </p>
            <div className="grid grid-cols-2 gap-3">
              <StatCell
                label="Wallet Balance"
                value={walletBalance}
                isLoading={isLoadingWalletBalance}
                onRefresh={() => void refetchAll()}
              />
              <StatCell
                label="Deposited"
                value={depositedAmount}
                isLoading={isLoadingDeposit}
                onRefresh={() => void refetchAll()}
              />
            </div>
          </div>

          {/* Queue status */}
          <BackstopQueueStatus
            inWithdrawalQueue={inWithdrawalQueue}
            queueExpiresAt={queueExpiresAt}
            queueExpired={queueExpired}
          />

          {/* Info notice */}
          <BackstopInfoAlert variant="info">
            Withdrawals require a{" "}
            <span className="font-semibold text-[#229EDF]">
              17-day queue period
            </span>
            . Initiate the queue first, then wait before withdrawing.
          </BackstopInfoAlert>
        </div>

        {/* Right: action form */}
        <BackstopActionPanel
          isLoading={isLoading}
          walletBalance={walletBalance}
          depositedAmount={depositedAmount}
          activeDepositAmount={activeDepositAmount}
          queuedDepositAmount={queuedDepositAmount}
          hasWallet={hasWallet}
          backstopTokenConfigured={backstopTokenConfigured}
          inWithdrawalQueue={inWithdrawalQueue}
          queueExpired={queueExpired}
          onDeposit={handleDeposit}
          onInitiateWithdrawal={handleInitiateWithdrawal}
          onWithdraw={handleWithdraw}
        />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  isLoading,
  onRefresh,
}: {
  label: string;
  value: string;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-[#252525] rounded-xl p-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-white/40 text-xs">{label}</p>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          aria-label={`Refresh ${label}`}
          className="text-white/20 hover:text-white/50 transition-colors disabled:opacity-30"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {isLoading ? (
        <div className="h-6 w-20 rounded bg-white/10 animate-pulse" />
      ) : (
        <p className="text-white font-bold text-xl tabular-nums">{value}</p>
      )}
    </div>
  );
}
