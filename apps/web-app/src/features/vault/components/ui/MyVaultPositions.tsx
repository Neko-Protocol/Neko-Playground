"use client";

import React from "react";
import Image from "next/image";
import {
  Wallet,
  Coins,
  TrendingUp,
  PieChart,
  Zap,
  BarChart2,
  Percent,
} from "lucide-react";
import { useVaultBalance } from "../../hooks/useVaultBalance";
import { useVaultData } from "../../hooks/useVaultData";
import { useVaultInvest } from "../../hooks/useVaultInvest";
import { useVaultApy } from "../../hooks/useVaultApy";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { VAULT_REGISTRY } from "../../const/vaults";

const STRATEGY_NAMES: Record<string, { name: string; color: string }> = {
  CCCEWBCYSIHTGBJ2TUOAFQY63UJ4SWDYTYNAEGXWPB7FP6PRHHGVZJIR: {
    name: "Neko",
    color: "#229EDF",
  },
  CCGV5QSAFRT6OGBZNCE72I6BAODXLDMWEUYAOBI5ZBLHOURSEGVGFTTZ: {
    name: "Aquarius",
    color: "#9B51E0",
  },
  CCY5WW3VXVJDBBXNYXCCH33XTQICHPU6RPFWYJJCT4PTYPN3SXJN2XBJ: {
    name: "Soroswap",
    color: "#00C2A8",
  },
  CBP5FUVUB4XWQ4ZUUDYR26CGHGLPN4FSHGCTRMTF4Z7V4H3DZFICOES3: {
    name: "Blend",
    color: "#F59E0B",
  },
};

const MyVaultPositions: React.FC = () => {
  const { userShares, isLoading, hasWallet } = useVaultBalance();
  const { data: vaultData } = useVaultData();
  const { idleAmount, totalAmount, allocations } = useVaultInvest();
  const { data: apyData } = useVaultApy();

  const vault = VAULT_REGISTRY["neko-usdc-cetes"];

  const cetesValue =
    vaultData && userShares > 0n
      ? parseFloat(
          fromSmallestUnit(
            (
              (userShares * vaultData.pricePerShare) /
              1_000_000_000_000n
            ).toString(),
            7
          )
        ).toFixed(2)
      : "0.00";

  const poolSharePct =
    vaultData && vaultData.totalShares > 0n && userShares > 0n
      ? ((Number(userShares) / Number(vaultData.totalShares)) * 100).toFixed(2)
      : "0.00";

  const userIdleCetes =
    vaultData && vaultData.totalShares > 0n && userShares > 0n && idleAmount > 0
      ? (
          idleAmount *
          (Number(userShares) / Number(vaultData.totalShares))
        ).toFixed(2)
      : "0";

  const hasIdle = parseFloat(userIdleCetes) > 0;

  // Strategy breakdown: only show strategies with amount > 0
  const activeAllocations = allocations
    .filter((a) => a.amount > 0)
    .map((a) => ({
      ...a,
      meta: STRATEGY_NAMES[a.strategy] ?? {
        name: a.strategy.slice(0, 6),
        color: "#666",
      },
      pct: totalAmount > 0 ? ((a.amount / totalAmount) * 100).toFixed(0) : "0",
    }));

  if (!hasWallet) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <Wallet className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm">
          Connect your wallet to see your vault positions
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <p className="text-white/40 text-sm">Loading your positions...</p>
      </div>
    );
  }

  if (userShares === 0n) {
    return (
      <div className="w-full rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
        <Coins className="h-8 w-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm">
          You don&apos;t have any vault positions yet.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/5 bg-[#1C1C1C]">
      <div className="flex items-center px-4 py-3 border-b border-white/5">
        <span className="text-white/40 text-xs font-semibold uppercase tracking-wide">
          Your Vault Positions
        </span>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-white/5">
            <th className="px-4 py-3 text-left">
              <div className="flex items-center gap-1.5 text-white/30 text-xs font-medium">
                <Coins className="h-3 w-3" />
                Vault
              </div>
            </th>
            <th className="px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
                <TrendingUp className="h-3 w-3" />
                Value
              </div>
            </th>
            <th className="px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
                <PieChart className="h-3 w-3" />
                Pool Share
              </div>
            </th>
            <th className="px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
                <Zap className="h-3 w-3" />
                Status
              </div>
            </th>
            <th className="px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
                <Percent className="h-3 w-3" />
                APY
              </div>
            </th>
            <th className="px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs font-medium">
                <BarChart2 className="h-3 w-3" />
                Allocated to
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="hover:bg-white/[0.02] transition-colors">
            {/* Vault */}
            <td className="px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#222] flex items-center justify-center overflow-hidden">
                  <Image
                    src={vault.supplyAsset.iconSrc}
                    alt={vault.supplyAsset.symbol}
                    width={20}
                    height={20}
                    unoptimized
                  />
                </div>
                <span className="text-white font-medium text-sm">
                  {vault.name}
                </span>
              </div>
            </td>

            {/* Value */}
            <td className="px-4 py-4 text-center">
              <span className="text-white font-bold text-sm tabular-nums">
                {cetesValue}
              </span>{" "}
              <span className="text-white/40 text-xs font-normal">CETES</span>
            </td>

            {/* Pool Share */}
            <td className="px-4 py-4 text-center">
              <span className="text-sm font-semibold text-[#229EDF]">
                {poolSharePct}%
              </span>
              <p className="text-white/30 text-xs mt-0.5">of TVL</p>
            </td>

            {/* Status */}
            <td className="px-4 py-4 text-center">
              {hasIdle ? (
                <div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-medium text-yellow-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    {userIdleCetes} idle
                  </span>
                  <p className="text-white/30 text-xs mt-1">not earning yet</p>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Earning
                </span>
              )}
            </td>

            {/* APY */}
            <td className="px-4 py-4 text-center">
              {apyData?.vaultApy != null ? (
                <div>
                  <span className="text-sm font-bold text-green-400">
                    {apyData.vaultApy.toFixed(2)}%
                  </span>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {apyData.strategies
                      .filter((s) => s.weight > 0)
                      .map((s) => (
                        <span key={s.name} className="text-white/30 text-xs">
                          {s.name}{" "}
                          {s.apy !== null ? `${s.apy.toFixed(1)}%` : "—"}
                        </span>
                      ))}
                  </div>
                </div>
              ) : (
                <span className="text-white/20 text-xs">—</span>
              )}
            </td>

            {/* Allocated to */}
            <td className="px-4 py-4">
              {activeAllocations.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                  {activeAllocations.map((a) => (
                    <div key={a.strategy} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: a.meta.color }}
                      />
                      <span className="text-xs text-white/70 w-16">
                        {a.meta.name}
                      </span>
                      <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${a.pct}%`,
                            backgroundColor: a.meta.color,
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-xs text-white/40 tabular-nums w-8 text-right">
                        {a.pct}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-white/20 text-xs">—</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default MyVaultPositions;
