"use client";

import React from "react";
import { Wallet, Coins, Hash, TrendingUp, Layers } from "lucide-react";
import { useUserLendingPositions } from "../../hooks/useUserLendingPositions";
import { useUserPositions } from "@/features/dashboard/hooks/useUserPositions";
import { ColHeader } from "./ColHeader";
import { TokenAvatar } from "@/features/borrowing/components/ui/TokenAvatar";

const MyLendingPositions: React.FC = () => {
  const { positions, isLoading, hasWallet } = useUserLendingPositions();
  const { positions: allPositions, isLoading: isLoadingAggregated } =
    useUserPositions();

  const aggregatedPositions = allPositions.filter(
    (p) => p.pool.type !== "neko" && p.position.deposited > 0n
  );

  if (!hasWallet) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <Wallet className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm">
          Connect your wallet to see your lending positions
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
      <div className="flex items-center px-4 py-3 border-b border-white/5">
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          Your Lending Positions
        </span>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            <ColHeader icon={Coins} label="Asset" />
            <ColHeader
              icon={Hash}
              label="bToken Balance"
              tooltip="Raw balance tokens held - these represent your share of the pool and grow in value as interest accrues"
              centered
            />
            <ColHeader
              icon={Layers}
              label="Deposited"
              tooltip="Actual amount you can withdraw: bToken balance x bToken rate"
              centered
            />
            <ColHeader
              icon={TrendingUp}
              label="Lend APR"
              tooltip="Annual interest rate you earn on your deposit"
              centered
            />
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-12 text-center text-white/40 text-sm"
              >
                Loading your positions...
              </td>
            </tr>
          ) : positions.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-12 text-center text-white/40 text-sm"
              >
                You don&apos;t have any active lending positions yet.
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
                <td className="px-4 py-4 text-center text-white/60 text-sm tabular-nums font-mono">
                  {pos.bTokensFormatted}
                </td>
                <td className="px-4 py-4 text-center text-white font-bold text-sm tabular-nums">
                  {pos.depositedFormatted}{" "}
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

      {(isLoadingAggregated || aggregatedPositions.length > 0) && (
        <>
          <div className="flex items-center px-4 py-3 border-t border-white/5">
            <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
              Aggregated Positions
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
                  label="Deposited"
                  tooltip="Amount deposited in this aggregated pool"
                  centered
                />
                <ColHeader
                  icon={TrendingUp}
                  label="APY"
                  tooltip="Annual yield from this pool"
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
              ) : aggregatedPositions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-12 text-center text-white/40 text-sm"
                  >
                    No aggregated lending positions.
                  </td>
                </tr>
              ) : (
                aggregatedPositions.map((pos) => (
                  <tr
                    key={pos.pool.id}
                    className="border-b border-white/5 hover:bg-white/2 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <TokenAvatar code={pos.pool.tokens[0]?.code ?? "?"} />
                        <span className="text-white font-medium text-sm">
                          {pos.pool.tokens[0]?.code ?? "?"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center text-white font-bold text-sm tabular-nums">
                      {pos.position.depositedFormatted}{" "}
                      <span className="text-white/40 font-normal">
                        {pos.pool.tokens[0]?.code ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center text-white text-sm">
                      {pos.pool.apy.toFixed(2)}%
                    </td>
                    <td className="px-4 py-4 text-center text-white/60 text-sm">
                      {pos.pool.name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default MyLendingPositions;
