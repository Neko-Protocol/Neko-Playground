"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Wallet, RefreshCw } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { usePools, orchestrator } from "@/lib/orchestrator";
import type { PoolInfo, PoolPosition, TokenInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";

function typeLabel(type: string): string {
  if (type === "blend" || type === "neko") return "Lending";
  if (type === "soroswap") return "AMM";
  return type;
}

interface PositionRow {
  pool: PoolInfo;
  position: PoolPosition;
  depositedDisplay: string;
  rewardsDisplay: string;
  borrowedDisplay: string;
  tokenCode: string;
}

function buildRows(
  pools: PoolInfo[],
  positions: (PoolPosition | undefined)[],
): PositionRow[] {
  const rows: PositionRow[] = [];

  pools.forEach((pool, i) => {
    const pos = positions[i];
    if (!pos) return;

    const hasDeposit = pos.deposited > 0n;
    const hasRewards = pos.rewards > 0n;
    const liabilities = pos.metadata?.liabilities;
    const hasBorrow =
      liabilities != null && String(liabilities) !== "0" && liabilities !== 0n;

    if (!hasDeposit && !hasRewards && !hasBorrow) return;

    const decimals = pool.tokens[0]?.decimals ?? 7;
    const tokenCode = pool.tokens[0]?.code ?? "?";

    rows.push({
      pool,
      position: pos,
      depositedDisplay: hasDeposit
        ? `${fromSmallestUnit(pos.deposited.toString(), decimals)} ${tokenCode}`
        : "—",
      rewardsDisplay: hasRewards ? pos.rewardsFormatted : "—",
      borrowedDisplay: hasBorrow
        ? `${fromSmallestUnit(String(liabilities), decimals)} ${tokenCode}`
        : "—",
      tokenCode,
    });
  });

  return rows;
}

const MyBalances: React.FC = () => {
  const router = useRouter();
  const { address } = useWallet();
  const { data: allPools = [], isLoading: isLoadingPools } = usePools();

  const positionQueries = useQueries({
    queries: allPools.map((pool) => ({
      queryKey: ["orchestrator", "position", pool.id, address],
      queryFn: () => orchestrator.getUserPosition(pool.id, address!),
      enabled: !!address && allPools.length > 0,
      staleTime: 15_000,
      retry: 1,
    })),
  });

  const isLoadingPositions =
    positionQueries.length > 0 && positionQueries.some((q) => q.isLoading);
  const positions = positionQueries.map((q) => q.data);
  const rows = React.useMemo(
    () => buildRows(allPools, positions),
    [allPools, positions],
  );

  const refetchAll = () => {
    positionQueries.forEach((q) => void q.refetch());
  };

  if (!address) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <Wallet className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm">
          Connect your wallet to see your pool balances
        </p>
      </div>
    );
  }

  const isLoading = isLoadingPools || isLoadingPositions;

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          Your Pool Positions
        </span>
        <button
          onClick={refetchAll}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-white/30 hover:text-white/60 transition-colors disabled:opacity-40"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
          />
          <span className="text-xs">Refresh</span>
        </button>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            <th className="px-4 py-3 text-left text-white/40 text-xs font-semibold uppercase tracking-wide">
              Pool
            </th>
            <th className="px-4 py-3 text-left text-white/40 text-xs font-semibold uppercase tracking-wide">
              Type
            </th>
            <th className="px-4 py-3 text-right text-white/40 text-xs font-semibold uppercase tracking-wide">
              Deposited
            </th>
            <th className="px-4 py-3 text-right text-white/40 text-xs font-semibold uppercase tracking-wide">
              Borrowed
            </th>
            <th className="px-4 py-3 text-right text-white/40 text-xs font-semibold uppercase tracking-wide">
              Rewards
            </th>
            <th className="px-4 py-3 text-right text-white/40 text-xs font-semibold uppercase tracking-wide">
              Action
            </th>
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
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={6}
                className="px-4 py-12 text-center text-white/40 text-sm"
              >
                You don&apos;t have any active pool positions yet.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.pool.id}
                className="border-b border-white/5 hover:bg-white/2 transition-colors"
              >
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-6 shrink-0">
                      <div className="absolute left-0 w-6 h-6 rounded-full bg-[#229EDF] border-2 border-[#1C1C1C] flex items-center justify-center text-white text-[10px] font-bold">
                        {(row.pool.tokens[0]?.code ?? "?")[0]}
                      </div>
                      <div className="absolute left-4 w-6 h-6 rounded-full bg-[#229EDF]/60 border-2 border-[#1C1C1C] flex items-center justify-center text-white text-[10px] font-bold">
                        {(row.pool.tokens[1]?.code ?? row.pool.tokens[0]?.code ?? "?")[0]}
                      </div>
                    </div>
                    <span className="text-white font-medium text-sm">
                      {row.pool.tokens.map((t: TokenInfo) => t.code).join(" / ")}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/50">
                    {typeLabel(row.pool.type)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right text-white text-sm tabular-nums">
                  {row.depositedDisplay}
                </td>
                <td className="px-4 py-4 text-right text-white text-sm tabular-nums">
                  {row.borrowedDisplay}
                </td>
                <td className="px-4 py-4 text-right text-white text-sm tabular-nums">
                  {row.rewardsDisplay}
                </td>
                <td className="px-4 py-4 text-right">
                  <button
                    onClick={() =>
                      router.push(`/dashboard/pools/${row.pool.id}`)
                    }
                    className="rounded-lg bg-[#229EDF] hover:bg-[#1a8bc7] px-3 py-1.5 text-white text-xs font-semibold transition-colors"
                  >
                    View Pool
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default MyBalances;
