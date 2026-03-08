"use client";

import React from "react";
import {
  Wallet,
  Coins,
  Shield,
  Hash,
  TrendingDown,
  Layers,
} from "lucide-react";
import { useUserBorrowPositions } from "../../hooks/useUserBorrowPositions";
import { useUserPositions } from "@/features/dashboard/hooks/useUserPositions";
import { TokenAvatar } from "./TokenAvatar";
import { ColHeader } from "./ColHeader";

const STELLAR_DECIMALS = 7;

const MyBorrowPositions: React.FC = () => {
  const { positions, isLoading, hasWallet } = useUserBorrowPositions();
  const { positions: allPositions, isLoading: isLoadingAggregated } =
    useUserPositions();

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
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
      <div className="flex items-center px-4 py-3 border-b border-white/5">
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          Your Borrow Positions
        </span>
      </div>

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
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-12 text-center text-white/40 text-sm"
              >
                Loading your positions...
              </td>
            </tr>
          ) : positions.length === 0 ? (
            <tr>
              <td
                colSpan={5}
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
              </tr>
            ))
          )}
        </tbody>
      </table>

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
  );
};

export default MyBorrowPositions;
