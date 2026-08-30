"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import { useUnifiedPositions } from "@/features/dashboard/hooks/useUnifiedPositions";
import { DelegationPanel } from "@/features/strategies/leverage/DelegationPanel";
import type {
  ProtocolKind,
  UnifiedPosition,
} from "@/features/dashboard/positions/types";

const PROTOCOL_LABELS: Record<ProtocolKind, string> = {
  wallet: "Wallet",
  pools: "Liquidity Pools",
  lending: "Lending",
  borrowing: "Borrowing",
  vault: "Vault",
  backstop: "Backstop",
  leverage: "Leverage",
};

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: number): string {
  if (value === 0) return "0";
  if (value >= 1000)
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return parseFloat(value.toFixed(4)).toString();
}

function PositionCardBody({ position }: { position: UnifiedPosition }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-white/30 rounded-full bg-white/5 px-2 py-0.5">
            {PROTOCOL_LABELS[position.protocol]}
          </span>
          {position.direction === "liability" && (
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[#E4574B]/80 rounded-full bg-[#E4574B]/10 px-2 py-0.5">
              Debt
            </span>
          )}
        </div>
        <p className="text-white font-semibold text-sm mt-1.5 truncate">
          {position.label}
        </p>
        <p className="text-white/40 text-xs mt-0.5">
          {formatQuantity(position.quantity)} {position.assetCode}
          {typeof position.apy === "number" &&
            ` · ${position.apy.toFixed(1)}% APY`}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={`font-semibold text-sm ${
            position.direction === "liability" ? "text-[#E4574B]" : "text-white"
          }`}
        >
          {position.valueUsd !== null
            ? `${position.direction === "liability" ? "-" : ""}${formatUsd(position.valueUsd)}`
            : "—"}
        </p>
      </div>
    </div>
  );
}

const YourPositions: React.FC = () => {
  const { positions, isLoading, hasWallet } = useUnifiedPositions();

  if (!hasWallet) return null;

  // Wallet spot balances already have their own "Wallet Holdings" chart above
  // — this section is for deployed/active positions across every protocol.
  const activePositions = positions.filter((p) => p.protocol !== "wallet");

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Your Positions
          </h2>
          <p className="text-white/40 text-sm">
            Active positions across pools, lending, vault and backstop
          </p>
        </div>
        <Link
          href="/lending"
          className="flex items-center gap-1.5 text-sm font-semibold text-white/40 hover:text-white transition-colors"
        >
          Manage
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-10 flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/20 border-t-white/60" />
          <span className="text-white/40 text-sm">Loading positions...</span>
        </div>
      ) : activePositions.length === 0 ? (
        <div className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-10 text-center">
          <Layers className="h-8 w-8 text-white/20 mx-auto mb-3" />
          <p className="text-white font-semibold text-sm mb-1">
            No active positions
          </p>
          <p className="text-white/40 text-xs mb-5">
            Deposit into a pool to start earning yield
          </p>
          <Link
            href="/pools"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#2A2A2A] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#333] transition-colors"
          >
            Explore Pools
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {activePositions.map((position) => {
            // Scope §7's delegation panel goes on the leverage position's
            // OWN card — attached only to the collateral row (id suffix
            // ":collateral"), not its paired debt row, so it renders once
            // per position. It needs an interactive revoke control, which
            // can't nest inside the row's own <Link> (invalid/inaccessible
            // HTML), so this row alone renders as a <div> with the label
            // wrapped in its own inner <Link> and the panel as a sibling.
            const leverageStrategyId =
              position.protocol === "leverage" &&
              position.id.endsWith(":collateral")
                ? position.id.slice("leverage:".length, -":collateral".length)
                : null;

            const body = <PositionCardBody position={position} />;

            if (leverageStrategyId) {
              return (
                <div
                  key={position.id}
                  className="rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 hover:border-white/10 transition-all duration-200"
                >
                  <Link href={position.href} className="block">
                    {body}
                  </Link>
                  <DelegationPanel positionId={leverageStrategyId} />
                </div>
              );
            }

            return (
              <Link
                key={position.id}
                href={position.href}
                className="block rounded-2xl bg-[#1C1C1C] border border-white/5 p-5 hover:border-white/10 hover:bg-[#222222] transition-all duration-200"
              >
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default YourPositions;
