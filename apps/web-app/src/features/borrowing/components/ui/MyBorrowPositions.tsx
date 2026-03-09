"use client";

import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Coins,
  Shield,
  Hash,
  TrendingDown,
  Layers,
  HeartPulse,
  Lock,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useUserBorrowPositions } from "../../hooks/useUserBorrowPositions";
import type { BorrowPosition } from "../../hooks/useUserBorrowPositions";
import { useHealthFactor } from "../../hooks/useHealthFactor";
import { useUserPositions } from "@/features/dashboard/hooks/useUserPositions";
import { useRepay } from "../../hooks/useRepay";
import { useRemoveCollateral } from "../../hooks/useRemoveCollateral";
import { HealthFactorBadge } from "./HealthFactorBadge";
import { BorrowQuickActions } from "./BorrowQuickActions";
import { RemoveCollateralModal } from "./RemoveCollateralModal";
import { TokenAvatar } from "./TokenAvatar";
import { ColHeader } from "./ColHeader";
import { RepayModal } from "./RepayModal";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { getTokenBalance } from "@/lib/helpers/stellar/lending";

const STELLAR_DECIMALS = 7;

const MyBorrowPositions: React.FC = () => {
  const { address } = useWallet();
  const { positions, isLoading, hasWallet } = useUserBorrowPositions();
  const { pools: hfPools, isLoading: isLoadingHF } = useHealthFactor(
    address ?? undefined
  );
  const { positions: allPositions, isLoading: isLoadingAggregated } =
    useUserPositions();
  const { handleRepay, isLoading: isRepaying, isWalletConnected } = useRepay();
  const {
    handleRemoveCollateral,
    isLoading: isRemoving,
    isWalletConnected: isRemoveWalletConnected,
  } = useRemoveCollateral();

  const [repayPosition, setRepayPosition] = useState<BorrowPosition | null>(
    null
  );
  const [removePosition, setRemovePosition] = useState<BorrowPosition | null>(
    null
  );
  const [selectedPosition, setSelectedPosition] =
    useState<BorrowPosition | null>(null);

  // Resolve the underlying token contract address for the position being repaid
  const repayAssetContract = useMemo(() => {
    if (!repayPosition) return "";
    return getAvailableTokens()[repayPosition.assetCode]?.contract ?? "";
  }, [repayPosition]);

  // Fetch wallet balance of the underlying asset when the repay modal is open
  const { data: repayWalletBalance = 0n, isLoading: isBalanceLoading } =
    useQuery({
      queryKey: ["repayWalletBalance", repayAssetContract, address],
      queryFn: () => getTokenBalance(repayAssetContract, address!),
      enabled: Boolean(repayPosition && repayAssetContract && address),
      staleTime: 15_000,
    });

  function getHealthFactor(contractId: string): number | null {
    return (
      hfPools.find((p) => p.contractId === contractId)?.healthFactor ?? null
    );
  }

  const handleRepaySubmit = useCallback(
    async (dTokens: bigint) => {
      if (!repayPosition) return;
      const result = await handleRepay({
        assetCode: repayPosition.assetCode,
        dTokens,
        contractId: repayPosition.contractId,
      });
      if (result?.success) setRepayPosition(null);
    },
    [repayPosition, handleRepay]
  );

  const handleRemoveSubmit = useCallback(
    async (amount: string) => {
      if (!removePosition) return;
      const result = await handleRemoveCollateral({
        rwaTokenAddress: removePosition.collateralToken,
        amount,
        collateralTokenCode: removePosition.collateralTokenCode,
        contractId: removePosition.contractId,
      });
      if (result?.success) setRemovePosition(null);
    },
    [removePosition, handleRemoveCollateral]
  );

  const aggregatedBorrowPositions = allPositions.filter((p) => {
    if (p.pool.type === "neko") return false;
    const liabilities = p.position.metadata?.liabilities;
    if (typeof liabilities === "bigint") return liabilities > 0n;
    if (typeof liabilities === "number") return liabilities > 0;
    if (typeof liabilities === "string") return parseFloat(liabilities) > 0;
    return false;
  });

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
    <>
      <BorrowQuickActions
        positions={positions}
        selectedPosition={selectedPosition}
        onSelectPosition={setSelectedPosition}
        onRemoveClick={() => {
          if (selectedPosition) setRemovePosition(selectedPosition);
        }}
        onRepayClick={() => {
          if (selectedPosition) setRepayPosition(selectedPosition);
        }}
      />

      <div className="w-full rounded-2xl border border-white/5 bg-[#1C1C1C]">
        {/* ── Neko borrow positions ── */}
        <div className="flex items-center px-4 py-3 border-b border-white/5">
          <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
            Your Borrow Positions
          </span>
        </div>

        {/* Desktop */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <ColHeader icon={Coins} label="Asset" centered />
                <ColHeader
                  icon={Shield}
                  label="Collateral Token"
                  tooltip="The token you posted as collateral to secure this borrow"
                  centered
                />
                <ColHeader
                  icon={Lock}
                  label="Collateral Amount"
                  tooltip="Total collateral you have locked in this pool"
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
                      <div className="flex items-center justify-center gap-3">
                        <TokenAvatar code={pos.assetCode} />
                        <span className="text-white font-medium text-sm">
                          {pos.assetCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <TokenAvatar code={pos.collateralTokenCode} />
                        <span className="text-white text-sm">
                          {pos.collateralTokenCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-white font-semibold text-sm tabular-nums">
                      {pos.collateralFormatted}{" "}
                      <span className="text-white/40 font-normal">
                        {pos.collateralTokenCode}
                      </span>
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
                <li
                  key={pos.assetCode}
                  className="px-4 py-4 flex flex-col gap-3"
                >
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

                  <div className="grid grid-cols-2 gap-2">
                    <MobileStat
                      label={`Collateral (${pos.collateralTokenCode})`}
                      value={pos.collateralFormatted}
                    />
                    <MobileStat
                      label={`Debt (${pos.assetCode})`}
                      value={pos.debtFormatted}
                    />
                    <MobileStat
                      label="APR"
                      value={`${pos.interestRate.toFixed(2)}%`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Aggregated (non-Neko) borrow positions ── */}
        {(isLoadingAggregated || aggregatedBorrowPositions.length > 0) && (
          <>
            <div className="flex items-center px-4 py-3 border-t border-white/5">
              <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
                Aggregated Borrow Positions
              </span>
              <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                Aggregated
              </span>
            </div>

            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <ColHeader icon={Coins} label="Asset" />
                  <ColHeader
                    icon={Layers}
                    label="Liabilities"
                    tooltip="Outstanding debt in this aggregated pool"
                    centered
                  />
                  <ColHeader
                    icon={TrendingDown}
                    label="Borrow APR"
                    tooltip="Annual interest rate on your debt"
                    centered
                  />
                  <ColHeader icon={Hash} label="Protocol" centered />
                </tr>
              </thead>
              <tbody>
                {isLoadingAggregated ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-white/40 text-sm"
                    >
                      Loading aggregated positions...
                    </td>
                  </tr>
                ) : aggregatedBorrowPositions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-white/40 text-sm"
                    >
                      No aggregated borrow positions.
                    </td>
                  </tr>
                ) : (
                  aggregatedBorrowPositions.map((pos) => {
                    const tokenCode = pos.pool.tokens[0]?.code ?? "?";
                    const decimals =
                      pos.pool.tokens[0]?.decimals ?? STELLAR_DECIMALS;
                    const liabilities = pos.position.metadata?.liabilities;
                    let liabilitiesFormatted = "0";
                    if (typeof liabilities === "bigint") {
                      liabilitiesFormatted = (
                        Number(liabilities) /
                        10 ** decimals
                      ).toFixed(decimals);
                    } else if (
                      typeof liabilities === "number" ||
                      typeof liabilities === "string"
                    ) {
                      liabilitiesFormatted = parseFloat(
                        String(liabilities)
                      ).toFixed(decimals);
                    }
                    const borrowApy =
                      typeof pos.pool.metadata.borrowApy === "number"
                        ? pos.pool.metadata.borrowApy
                        : pos.pool.apy;

                    return (
                      <tr
                        key={pos.pool.id}
                        className="border-b border-white/5 hover:bg-white/2 transition-colors"
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <TokenAvatar code={tokenCode} />
                            <span className="text-white font-medium text-sm">
                              {tokenCode}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center text-white font-bold text-sm tabular-nums">
                          {liabilitiesFormatted}{" "}
                          <span className="text-white/40 font-normal">
                            {tokenCode}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center text-white text-sm">
                          {borrowApy.toFixed(2)}%
                        </td>
                        <td className="px-4 py-4 text-center text-white/60 text-sm">
                          {pos.pool.name}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {repayPosition && (
        <RepayModal
          position={repayPosition}
          walletBalance={repayWalletBalance}
          isBalanceLoading={isBalanceLoading}
          isProcessing={isRepaying}
          isWalletConnected={isWalletConnected}
          onClose={() => setRepayPosition(null)}
          onSubmit={handleRepaySubmit}
        />
      )}

      {removePosition && (
        <RemoveCollateralModal
          position={removePosition}
          isProcessing={isRemoving}
          isWalletConnected={isRemoveWalletConnected}
          onClose={() => setRemovePosition(null)}
          onSubmit={handleRemoveSubmit}
        />
      )}
    </>
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
