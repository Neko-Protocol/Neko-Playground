"use client";

import React, { useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import Image from "next/image";
import { orchestrator, useUserPosition } from "@/lib/orchestrator";
import { getTokenIcon } from "@/lib/helpers/tokenUtils";
import type { PoolAction, TokenInfo } from "@/lib/orchestrator";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { useWallet } from "@/hooks/useWallet";
import { usePoolDetail } from "@/features/pools/hooks/usePoolDetail";
import { PageContainer } from "@/components/ui/PageContainer";
import { PoolActionModal } from "../PoolActionModal";

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
        <div className="w-full max-w-md rounded-2xl bg-[#1C1C1C] border border-white/5 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-white/10 border-t-[#229EDF] mx-auto mb-4" />
          <p className="text-white/40 text-sm">Loading pool...</p>
        </div>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full rounded-2xl bg-red-500/10 border border-red-500/20 p-8 text-center">
          <h1 className="text-xl font-bold text-red-400 mb-2">
            Pool not found
          </h1>
          <p className="text-red-400/70 text-sm mb-6">
            {error instanceof Error
              ? error.message
              : "Could not load pool data."}
          </p>
          <Link
            href="/pools"
            className="text-[#229EDF] font-semibold text-sm hover:underline"
          >
            &larr; Back to Pools
          </Link>
        </div>
      </div>
    );
  }

  const { token1, token2, tvlFormatted, apyFormatted, typeLabel } = pool;

  return (
    <PageContainer maxWidth="3xl" className="min-h-screen">
      <Link
        href="/pools"
        className="inline-flex items-center gap-1 text-white/60 hover:text-white mb-6 font-medium text-sm transition-colors"
      >
        &larr; Back to Pools
      </Link>

      <div className="rounded-2xl bg-[#1C1C1C] p-8 border border-white/5 relative overflow-hidden">
        {}
        <div className="relative z-10 mb-8">
          <div className="flex items-center gap-4 mb-4">
            {}
            <div className="relative w-18 h-10 shrink-0 flex items-center">
              {(() => {
                const icon1 = getTokenIcon({
                  type: "contract",
                  code: token1,
                });
                const icon2 = getTokenIcon({
                  type: "contract",
                  code: token2,
                });
                return (
                  <>
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neko-teal border-2 border-neko-border flex items-center justify-center overflow-hidden shadow-md z-1">
                      {icon1 ? (
                        <Image
                          src={icon1}
                          alt={token1}
                          width={32}
                          height={32}
                          unoptimized
                        />
                      ) : (
                        <span className="text-white text-sm font-bold">
                          {token1[0]}
                        </span>
                      )}
                    </div>
                    <div className="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-neko-teal-light border-2 border-neko-border flex items-center justify-center overflow-hidden shadow-md z-2">
                      {icon2 ? (
                        <Image
                          src={icon2}
                          alt={token2}
                          width={32}
                          height={32}
                          unoptimized
                        />
                      ) : (
                        <span className="text-neko-navy text-sm font-bold">
                          {token2[0]}
                        </span>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-white wrap-break-word">
                {pool.name || `${token1} / ${token2}`}
              </h1>
              <div className="inline-block bg-white/10 text-white text-xs font-semibold px-2 py-1 rounded-md mt-1">
                {typeLabel}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pool.state === "active" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#229EDF]/10 border border-[#229EDF]/20">
                  <div className="w-2 h-2 rounded-full bg-[#229EDF] animate-pulse" />
                  <span className="text-[#229EDF] text-xs font-bold uppercase tracking-wider">Active</span>
                </div>
              )}
              {pool.state === "on_ice" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  <span className="text-orange-500 text-xs font-bold uppercase tracking-wider">On Ice</span>
                </div>
              )}
              {pool.state === "frozen" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-red-500 text-xs font-bold uppercase tracking-wider">Frozen</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#2A2A2A] rounded-xl p-4 border border-white/10">
            <p className="text-white/40 text-xs mb-1">TVL</p>
            <p className="text-white text-lg font-bold">{tvlFormatted}</p>
          </div>
          <div className="bg-[#2A2A2A] rounded-xl p-4 border border-white/10">
            <p className="text-white/40 text-xs mb-1">APY</p>
            <p className="text-white text-lg font-bold">{apyFormatted}</p>
          </div>
          <div className="bg-[#2A2A2A] rounded-xl p-4 border border-white/10">
            <p className="text-white/40 text-xs mb-1">Status</p>
            <p className={`text-lg font-bold capitalize ${
              pool.state === 'active' ? 'text-[#229EDF]' : 
              pool.state === 'on_ice' ? 'text-orange-500' : 
              pool.state === 'frozen' ? 'text-red-500' : 'text-white'
            }`}>
              {pool.state === 'on_ice' ? 'On Ice' : pool.state}
            </p>
          </div>
          <div className="bg-[#2A2A2A] rounded-xl p-4 border border-white/10">
            <p className="text-white/40 text-xs mb-1">Tokens</p>
            <p className="text-white text-lg font-bold">
              {pool.tokens.map((t: TokenInfo) => t.code).join(" / ")}
            </p>
          </div>
        </div>

        {}
        {address && (
          <div className="relative z-10 mb-8 rounded-xl border border-[#229EDF]/30 bg-[#2A2A2A] p-4">
            <h3 className="text-white/40 text-sm font-semibold mb-3">
              Tu posición
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-white/40 text-xs mb-1">
                  {pool.type === "blend"
                    ? "Total (incl. intereses)"
                    : "Depositado"}
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
                    <p className="text-white/40 text-xs mb-1">Recompensas</p>
                    <p className="text-white text-lg font-bold">
                      {position.rewardsFormatted}
                    </p>
                  </div>
                )}
              {pool.type === "blend" &&
                position?.metadata?.liabilities != null &&
                String(position.metadata.liabilities) !== "0" && (
                  <div>
                    <p className="text-white/40 text-xs mb-1">Prestado</p>
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

        {}
        <div className="relative z-10 flex flex-wrap gap-3">
          {(pool.type === "blend" || pool.type === "neko") && (
            <button
              className="bg-[#229EDF] hover:bg-[#1a8bc7] text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#229EDF]"
              onClick={() => setActionModal("deposit")}
              disabled={pool.state !== "active"}
            >
              Lend
            </button>
          )}
          {supportedActions.includes("deposit") &&
            pool.type !== "blend" &&
            pool.type !== "neko" && (
              <button
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setActionModal("deposit")}
                disabled={pool.state !== "active"}
              >
                Deposit
              </button>
            )}
          {supportedActions.includes("withdraw") && (
            <button
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setActionModal("withdraw")}
              disabled={pool.state === "frozen"}
            >
              Withdraw
            </button>
          )}
          {supportedActions.includes("borrow") && (
            <button
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setActionModal("borrow")}
              disabled={pool.state !== "active"}
            >
              Borrow
            </button>
          )}
          {supportedActions.includes("repay") && (
            <button
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setActionModal("repay")}
              disabled={pool.state === "frozen"}
            >
              Repay
            </button>
          )}
          {supportedActions.includes("supplyCollateral") && (
            <button
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setActionModal("supplyCollateral")}
              disabled={pool.state !== "active"}
            >
              Supply Collateral
            </button>
          )}
          {supportedActions.includes("withdrawCollateral") && (
            <button
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setActionModal("withdrawCollateral")}
              disabled={pool.state === "frozen"}
            >
              Withdraw Collateral
            </button>
          )}
          {supportedActions.includes("claimRewards") && (
            <button
              className="bg-[#229EDF] hover:bg-[#1a8bc7] text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => setActionModal("claimRewards")}
              disabled={pool.state === "frozen"}
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

        {}
        <details className="relative z-10 mt-8">
          <summary className="text-white/40 text-sm cursor-pointer hover:text-white transition-colors">
            Contract ID
          </summary>
          <div className="mt-2 bg-[#2A2A2A] text-[#229EDF] font-mono text-xs px-4 py-2 rounded-lg break-all border border-white/10">
            {contractid}
          </div>
        </details>
      </div>
    </PageContainer>
  );
};

export default PoolDetail;
