"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, ShieldCheck, ShieldOff } from "lucide-react";
import type { DelegationGrant } from "@/lib/coordinator/types";

export interface DelegationPanelProps {
  positionId: string;
}

export const LEVERAGE_DELEGATION_QUERY_KEY = "leverage-delegation";

/**
 * Reads and revokes a position's coordinator delegation. Grant creation
 * happens inline in useOpenLeveragePosition, right after the loop's steps
 * execute — this hook is only for the read/revoke side, and DelegationPanel
 * (below) is its only consumer, so the two live in one file.
 */
function useLeverageDelegation(positionId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = [LEVERAGE_DELEGATION_QUERY_KEY, positionId];

  const query = useQuery<{ grant: DelegationGrant | null }>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(
        `/api/leverage/delegation?positionId=${encodeURIComponent(positionId!)}`
      );
      if (!response.ok) throw new Error("Failed to load delegation status");
      return response.json();
    },
    enabled: Boolean(positionId),
    staleTime: 15_000,
    retry: false,
    throwOnError: false,
  });

  const revoke = useCallback(async () => {
    if (!positionId) return;
    const response = await fetch(
      `/api/leverage/delegation?positionId=${encodeURIComponent(positionId)}`,
      { method: "DELETE" }
    );
    if (!response.ok) throw new Error("Failed to revoke delegation");
    await queryClient.invalidateQueries({ queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positionId, queryClient]);

  return {
    grant: query.data?.grant ?? null,
    isLoading: query.isLoading,
    revoke,
  };
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Scope §7's delegation management panel: shows the current grant, its
 * bounds, and a revoke control. Reads/writes through
 * app/api/leverage/delegation/route.ts — never asks for a signature itself,
 * since the grant was already fully signed at position-open time
 * (useOpenLeveragePosition).
 */
export function DelegationPanel({ positionId }: DelegationPanelProps) {
  const { grant, isLoading, revoke } = useLeverageDelegation(positionId);
  const [expanded, setExpanded] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  if (isLoading) return null;

  if (!grant) {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-white/40">
        <ShieldOff size={13} />
        No automated deleveraging delegation for this position.
      </div>
    );
  }

  const remainingTranches =
    grant.tranches.length - grant.consumedTrancheIds.length;
  const isActive = grant.status === "active" && Date.now() < grant.expiresAt;

  return (
    <div className="mt-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <span
          className={`flex items-center gap-1.5 font-medium ${isActive ? "text-green-400" : "text-white/40"}`}
        >
          {isActive ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
          Automated deleveraging {isActive ? "enabled" : grant.status}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 text-white/60">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-white/30">Unwind threshold</p>
              <p className="text-white/80">
                {grant.guardConfig.deleverageThreshold.toFixed(2)} HF
              </p>
            </div>
            <div>
              <p className="text-white/30">Recovery hysteresis</p>
              <p className="text-white/80">
                +{grant.guardConfig.hysteresis.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-white/30">Tranches remaining</p>
              <p className="text-white/80">
                {remainingTranches} / {grant.tranches.length}
              </p>
            </div>
            <div>
              <p className="text-white/30">Valid until</p>
              <p className="text-white/80">{formatDate(grant.expiresAt)}</p>
            </div>
          </div>
          <p className="text-white/30">
            Scope: repay/withdraw only, only on this position, only up to
            what&apos;s needed to clear a breach — never opens new leverage,
            never touches any other position.
          </p>
          {isActive && (
            <button
              type="button"
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsRevoking(true);
                try {
                  await revoke();
                } finally {
                  setIsRevoking(false);
                }
              }}
              disabled={isRevoking}
              className="mt-1 self-start rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-40"
            >
              {isRevoking ? "Revoking…" : "Revoke delegation"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default DelegationPanel;
