"use client";

import React from "react";
import {
  Wallet,
  Coins,
  Shield,
  Hash,
  TrendingDown,
  Layers,
  HeartPulse,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useUserBorrowPositions } from "../../hooks/useUserBorrowPositions";
import { useHealthFactor } from "../../hooks/useHealthFactor";
import { HealthFactorBadge } from "./HealthFactorBadge";
import { TokenAvatar } from "./TokenAvatar";
import { ColHeader } from "./ColHeader";

const MyBorrowPositions: React.FC = () => {
  const { address } = useWallet();
  const { positions, isLoading, hasWallet } = useUserBorrowPositions();
  const { pools: hfPools, isLoading: isLoadingHF } = useHealthFactor(
    address ?? undefined
  );

  function getHealthFactor(contractId: string): number | null {
    return (
      hfPools.find((p) => p.contractId === contractId)?.healthFactor ?? null
    );
  }

  if (!hasWallet) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <Wallet className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm">
          Connect your wallet to see your borrow positions
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-white/5 bg-[#1C1C1C]">
      <div className="flex items-center px-4 py-3 border-b border-white/5">
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          Your Borrow Positions
        </span>
      </div>

      {/* Desktop */}
      <div className="hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <ColHeader icon={Coins} label="Asset" />
              <ColHeader
                icon={Shield}
                label="Collateral"
                tooltip="The RWA token you posted as collateral to secure this borrow"
              />
              <ColHeader
                icon={Hash}
                label="dToken Balance"
                tooltip="Raw debt tokens held — these represent your share of the total debt pool and grow over time as interest accrues"
                centered
              />
              <ColHeader
                icon={Layers}
                label="Current Debt"
                tooltip="Actual amount owed: dToken balance × dToken rate, converted to the borrowed asset"
                centered
              />
              <ColHeader
                icon={TrendingDown}
                label="Borrow APR"
                tooltip="Annual interest rate applied to your debt"
                centered
              />
              <ColHeader
                icon={HeartPulse}
                label="Health Factor"
                tooltip="Your current health factor for this pool. Keep above 1.0 to avoid liquidation."
                centered
              />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  Loading your positions...
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-white/40 text-sm"
                >
                  You don&apos;t have any active borrow positions yet.
                </td>
              </tr>
            ) : (
              positions.map((pos) => (
                <tr
                  key={pos.assetCode}
                  className="border-b border-white/5 hover:bg-white/2 transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <TokenAvatar code={pos.assetCode} />
                      <span className="text-white font-medium text-sm">
                        {pos.assetCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <TokenAvatar code={pos.collateralTokenCode} />
                      <span className="text-white text-sm">
                        {pos.collateralTokenCode}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-white/60 text-sm tabular-nums font-mono">
                    {pos.dTokensFormatted}
                  </td>
                  <td className="px-4 py-4 text-center text-white font-bold text-sm tabular-nums">
                    {pos.debtFormatted}{" "}
                    <span className="text-white/40 font-normal">
                      {pos.assetCode}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center text-white text-sm">
                    {pos.interestRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex justify-center">
                      <HealthFactorBadge
                        healthFactor={getHealthFactor(pos.contractId)}
                        isLoading={isLoadingHF}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        {isLoading ? (
          <p className="px-4 py-12 text-center text-white/40 text-sm">
            Loading your positions...
          </p>
        ) : positions.length === 0 ? (
          <p className="px-4 py-12 text-center text-white/40 text-sm">
            You don&apos;t have any active borrow positions yet.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {positions.map((pos) => (
              <li key={pos.assetCode} className="px-4 py-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <TokenAvatar code={pos.assetCode} />
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {pos.assetCode}
                      </p>
                      <p className="text-white/40 text-xs">
                        Collateral: {pos.collateralTokenCode}
                      </p>
                    </div>
                  </div>
                  <HealthFactorBadge
                    healthFactor={getHealthFactor(pos.contractId)}
                    isLoading={isLoadingHF}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <MobileStat
                    label="Current Debt"
                    value={`${pos.debtFormatted} ${pos.assetCode}`}
                  />
                  <MobileStat
                    label="APR"
                    value={`${pos.interestRate.toFixed(2)}%`}
                  />
                  <MobileStat
                    label="dTokens"
                    value={pos.dTokensFormatted}
                    mono
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

function MobileStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-[#242424] px-2 py-2.5">
      <span className="text-white/40 text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </span>
      <span
        className={`text-white text-xs font-medium ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export default MyBorrowPositions;
