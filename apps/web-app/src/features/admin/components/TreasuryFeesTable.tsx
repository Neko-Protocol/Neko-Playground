"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { lendingService } from "@/lib/services/lending.service";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { Networks } from "@stellar/stellar-sdk";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import { POOLS } from "../constants";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";

function TreasuryFeesTableInner({ pool }: { pool: (typeof POOLS)[number] }) {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useToast();
  const queryClient = useQueryClient();
  const [collecting, setCollecting] = useState<string | null>(null);

  const { data: credits, isLoading } = useQuery({
    queryKey: ["admin", "treasuryCredit", pool.contractId],
    queryFn: async () => {
      const tokens = getAvailableTokens();
      const result: { asset: string; credit: string; decimals: number }[] = [];
      for (const asset of pool.assets) {
        const token = tokens[asset];
        if (!token?.contract) continue;
        const credit = await lendingService.getTreasuryCredit(
          asset,
          pool.contractId
        );
        result.push({
          asset,
          credit,
          decimals: token.decimals ?? 7,
        });
      }
      return result;
    },
    staleTime: 30_000,
  });

  const handleCollect = async (asset: string) => {
    if (!address) return;
    setCollecting(asset);
    try {
      const result = await lendingService.collectTreasuryFees(
        asset,
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
        description: `Collected treasury fees for ${asset}`,
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "treasuryCredit", pool.contractId],
      });
    } catch (err) {
      const msg = extractContractErrorOrNull(err);
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: typeof msg === "string" ? msg : "Failed to collect fees",
      });
    } finally {
      setCollecting(null);
    }
  };

  if (isLoading || !credits) {
    return (
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/10 p-6">
        <h3 className="text-white font-semibold mb-4">{pool.name}</h3>
        <p className="text-white/50 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#1C1C1C] border border-white/10 p-6">
      <h3 className="text-white font-semibold mb-4">{pool.name}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-white/60 border-b border-white/10">
              <th className="pb-3 pr-4">Asset</th>
              <th className="pb-3 pr-4">Pending</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {credits.map(({ asset, credit, decimals }) => {
              const creditBig = BigInt(credit);
              const displayAmount =
                creditBig > 0n ? fromSmallestUnit(credit, decimals) : "0";
              const hasCredit = creditBig > 0n;
              return (
                <tr
                  key={asset}
                  className="border-b border-white/5 text-white/90"
                >
                  <td className="py-3 pr-4 font-medium">{asset}</td>
                  <td className="py-3 pr-4">{displayAmount}</td>
                  <td className="py-3">
                    <button
                      onClick={() => void handleCollect(asset)}
                      disabled={!hasCredit || collecting === asset}
                      className="px-3 py-1.5 rounded-lg bg-[#229EDF] hover:bg-[#1e8bc9] text-white text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {collecting === asset ? "Collecting..." : "Collect"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TreasuryFeesTable() {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">
        Treasury Fees (Pending)
      </h2>
      <div className="space-y-4">
        {POOLS.map((pool) => (
          <TreasuryFeesTableInner key={pool.id} pool={pool} />
        ))}
      </div>
    </section>
  );
}
