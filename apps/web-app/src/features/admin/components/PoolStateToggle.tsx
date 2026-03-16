"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { lendingService } from "@/lib/services/lending.service";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { Networks } from "@stellar/stellar-sdk";
import { POOLS } from "../constants";
import type { PoolState } from "@neko/lending";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";

const POOL_STATES: { value: PoolState; label: string }[] = [
  { value: { tag: "Active", values: undefined }, label: "Active" },
  { value: { tag: "OnIce", values: undefined }, label: "On Ice" },
  { value: { tag: "Frozen", values: undefined }, label: "Frozen" },
];

function PoolStateToggleInner({ pool }: { pool: (typeof POOLS)[number] }) {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: poolState, isLoading } = useQuery({
    queryKey: ["admin", "poolState", pool.contractId],
    queryFn: () => lendingService.getPoolState(pool.contractId),
    staleTime: 30_000,
  });

  const currentTag = poolState?.tag ?? "Active";

  const handleChange = async (state: PoolState) => {
    if (!address || currentTag === state.tag) return;
    setLoading(true);
    try {
      const result = await lendingService.setPoolState(
        state,
        address,
        pool.contractId
      );
      if (result.error) {
        addNotification("Error", "error", {
          ...TOAST_CONFIG.defaultOpts,
          description: result.error,
        });
        return;
      }
      await signAndSendTransaction(result.xdr, signTransaction, {
        networkPassphrase: networkPassphrase || Networks.TESTNET,
        rpcUrl,
        address,
        waitForPending: true,
      });
      addNotification("Success", "success", {
        ...TOAST_CONFIG.defaultOpts,
        description: `Pool state set to ${state.tag}`,
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "poolState", pool.contractId],
      });
      void queryClient.invalidateQueries({ queryKey: ["lendingPools"] });
      void queryClient.invalidateQueries({ queryKey: ["borrowPools"] });
    } catch (err) {
      const msg = extractContractErrorOrNull(err);
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: typeof msg === "string" ? msg : "Failed to set pool state",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/10 p-6">
        <h3 className="text-white font-semibold mb-2">{pool.name}</h3>
        <p className="text-white/50 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#1C1C1C] border border-white/10 p-6">
      <h3 className="text-white font-semibold mb-4">{pool.name}</h3>
      <div className="flex flex-wrap gap-2">
        {POOL_STATES.map(({ value, label }) => (
          <button
            key={value.tag}
            onClick={() => void handleChange(value)}
            disabled={loading || currentTag === value.tag}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              currentTag === value.tag
                ? "bg-[#229EDF] text-white"
                : "bg-[#2A2A2A] hover:bg-[#333] text-white/80 border border-white/5"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function PoolStateToggle() {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">Pool State</h2>
      <div className="space-y-4">
        {POOLS.map((pool) => (
          <PoolStateToggleInner key={pool.id} pool={pool} />
        ))}
      </div>
    </section>
  );
}
