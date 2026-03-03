"use client";

import React, { useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { orchestrator, useUserPosition } from "@/lib/orchestrator";
import type { PoolAction, TokenInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { useWallet } from "@/hooks";
import { PoolActionModal } from "../PoolActionModal";
import { usePoolDetail } from "@/features/pools/hooks/usePoolDetail";

interface PoolDetailProps {
  params: Promise<{ contractid: string }>;
}

const PoolDetail: React.FC<PoolDetailProps> = ({ params }) => {
  const { contractid: rawId } = use(params);
  const contractid = decodeURIComponent(rawId);
  const [actionModal, setActionModal] = useState<PoolAction | null>(null);
  const { address } = useWallet();
  const { data: pool, isLoading, error } = usePoolDetail(contractid);
  const { data: position } = useUserPosition(contractid, address);

  // Must run before any early return to satisfy Rules of Hooks
  const supportedActions = useMemo(
    () =>
      pool
        ? pool.supportedActions.filter((a: PoolAction) =>
            orchestrator.supportsAction(contractid, a)
          )
        : [],
    [contractid, pool]
  );

  if (isLoading) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-neko-border/30 border-t-neko-border mx-auto mb-4" />
          <p className="text-neko-blue text-lg">Loading pool...</p>
        </div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full bg-red-50 rounded-3xl shadow-lg border border-red-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Pool not found
          </h1>
          <p className="text-red-500 mb-6">
            {error instanceof Error
              ? error.message
              : "Could not load pool data."}
          </p>
          <Link
            href="/dashboard/pools"
            className="text-neko-border font-semibold hover:underline"
          >
            ← Back to Pools
          </Link>
        </div>
      </div>
    );
  }

  const { token1, token2, tvlFormatted, apyFormatted, typeLabel } = pool;

  return (
    <div className="w-full min-h-screen px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/pools"
          className="inline-flex items-center gap-1 text-neko-blue hover:text-neko-border mb-6 font-medium"
        >
          ← Back to Pools
        </Link>

        <div className="rounded-3xl bg-neko-accent p-8 shadow-xl border border-neko-border/50 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 w-40 h-40 bg-neko-border/20 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative w-16 h-10">
                <div className="absolute left-0 w-10 h-10 rounded-full bg-neko-teal border-2 border-neko-border flex items-center justify-center text-white text-sm font-bold shadow-md">
                  {token1[0]}
                </div>
                <div className="absolute left-8 w-10 h-10 rounded-full bg-neko-teal-light border-2 border-neko-border flex items-center justify-center text-neko-navy text-sm font-bold shadow-md">
                  {token2[0]}
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {pool.name || `${token1} / ${token2}`}
                </h1>
                <div className="inline-block bg-white/10 text-white text-xs font-semibold px-2 py-1 rounded-md mt-1">
                  {typeLabel}
                </div>
              </div>
              <div
                className={`ml-auto w-3 h-3 rounded-full ${
                  pool.state === "active" ? "bg-neko-teal" : "bg-gray-400"
                } animate-pulse`}
              />
            </div>
          </div>

          {/* Stats Grid */}
          <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-neko-accent rounded-xl p-4 border border-white/10">
              <p className="text-neko-muted text-xs mb-1">TVL</p>
              <p className="text-white text-lg font-bold">{tvlFormatted}</p>
            </div>
            <div className="bg-neko-accent rounded-xl p-4 border border-white/10">
              <p className="text-neko-muted text-xs mb-1">APY</p>
              <p className="text-white text-lg font-bold">{apyFormatted}</p>
            </div>
            <div className="bg-neko-accent rounded-xl p-4 border border-white/10">
              <p className="text-neko-muted text-xs mb-1">Status</p>
              <p className="text-white text-lg font-bold capitalize">
                {pool.state}
              </p>
            </div>
            <div className="bg-neko-accent rounded-xl p-4 border border-white/10">
              <p className="text-neko-muted text-xs mb-1">Tokens</p>
              <p className="text-white text-lg font-bold">
                {pool.tokens.map((t: TokenInfo) => t.code).join(" / ")}
              </p>
            </div>
          </div>

          {/* Your position */}
          {address && (
            <div className="relative z-10 mb-8 rounded-xl border border-neko-teal/40 bg-neko-navy/30 p-4">
              <h3 className="text-neko-muted text-sm font-semibold mb-3">
                Your Position
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-neko-muted text-xs mb-1">
                    {pool.type === "blend"
                      ? "Total (incl. interest)"
                      : "Deposited"}
                  </p>
                  <p className="text-white text-lg font-bold">
                    {position?.depositedFormatted ?? "0"}{" "}
                    {pool.tokens[0]?.code ?? ""}
                  </p>
                </div>
                {pool.type !== "blend" &&
                  position?.rewardsFormatted != null &&
                  position.rewardsFormatted !== "0" && (
                    <div>
                      <p className="text-neko-muted text-xs mb-1">
                        Rewards
                      </p>
                      <p className="text-white text-lg font-bold">
                        {position.rewardsFormatted}
                      </p>
                    </div>
                  )}
                {pool.type === "blend" &&
                  position?.metadata?.liabilities != null &&
                  String(position.metadata.liabilities) !== "0" && (
                    <div>
                      <p className="text-neko-muted text-xs mb-1">Borrowed</p>
                      <p className="text-white text-lg font-bold">
                        {fromSmallestUnit(
                          String(position.metadata.liabilities),
                          pool.tokens[0]?.decimals ?? 7
                        )}{" "}
                        {pool.tokens[0]?.code ?? ""}
                      </p>
                    </div>
                  )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="relative z-10 flex flex-wrap gap-3">
            {(pool.type === "blend" || pool.type === "neko") && (
              <button
                className="bg-neko-navy hover:bg-neko-navy-hover text-neko-cream px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-neko-border/30"
                onClick={() => setActionModal("deposit")}
              >
                Lend
              </button>
            )}
            {supportedActions.includes("deposit") &&
              pool.type !== "blend" &&
              pool.type !== "neko" && (
                <button
                  className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20"
                  onClick={() => setActionModal("deposit")}
                >
                  Deposit
                </button>
              )}
            {supportedActions.includes("withdraw") && (
              <button
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20"
                onClick={() => setActionModal("withdraw")}
              >
                Withdraw
              </button>
            )}
            {supportedActions.includes("borrow") && (
              <button
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20"
                onClick={() => setActionModal("borrow")}
              >
                Borrow
              </button>
            )}
            {supportedActions.includes("repay") && (
              <button
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20"
                onClick={() => setActionModal("repay")}
              >
                Repay
              </button>
            )}
            {supportedActions.includes("supplyCollateral") && (
              <button
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20"
                onClick={() => setActionModal("supplyCollateral")}
              >
                Supply Collateral
              </button>
            )}
            {supportedActions.includes("withdrawCollateral") && (
              <button
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20"
                onClick={() => setActionModal("withdrawCollateral")}
              >
                Withdraw Collateral
              </button>
            )}
            {supportedActions.includes("claimRewards") && (
              <button
                className="bg-neko-teal hover:bg-neko-teal/90 text-neko-navy px-6 py-3 rounded-xl text-sm font-bold transition-colors"
                onClick={() => setActionModal("claimRewards")}
              >
                Claim Rewards
              </button>
            )}
          </div>

          {actionModal && (
            <PoolActionModal
              isOpen={!!actionModal}
              onClose={() => setActionModal(null)}
              pool={pool}
              poolId={contractid}
              action={actionModal}
            />
          )}

          {/* Contract ID (collapsed) */}
          <details className="relative z-10 mt-8">
            <summary className="text-neko-muted text-sm cursor-pointer hover:text-white">
              Contract ID
            </summary>
            <div className="mt-2 bg-neko-navy/50 text-neko-teal-light font-mono text-xs px-4 py-2 rounded-lg break-all border border-neko-border/30">
              {contractid}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default PoolDetail;
