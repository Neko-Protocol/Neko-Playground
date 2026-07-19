"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { lendingService } from "@/lib/services/lending.service";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import { POOLS, POOL2_COLLATERAL_ASSETS } from "../constants";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { invalidateProtocolQueries } from "@/lib/helpers/invalidateProtocolQueries";
import { toSmallestUnit } from "@/lib/helpers/tokenUtils";
import { Networks } from "@stellar/stellar-sdk";
import type { AssetType } from "@neko/lending";

const SCALAR_7 = 10_000_000;

/** Pool 1 collateral is RWA (USTRY, etc.), Pool 2 collateral is USDC/XLM */
const POOL1_COLLATERAL_CODES = [
  "USTRY",
  "TESOURO",
  "CETES",
  "USDY",
  "PYUSD",
  "KTB",
];

const ALL_COLLATERAL = [
  ...POOL1_COLLATERAL_CODES.map((code) => ({
    code,
    poolId: "pool1",
    contractId: POOLS[0].contractId,
    assetType: { tag: "Rwa" as const, values: undefined } as AssetType,
  })),
  ...POOL2_COLLATERAL_ASSETS.map((code) => ({
    code,
    poolId: "pool2",
    contractId: POOLS[1].contractId,
    assetType: { tag: "Crypto" as const, values: undefined } as AssetType,
  })),
];

export default function CollateralFactorForm() {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(ALL_COLLATERAL[0]?.code ?? "");
  const [factorPercent, setFactorPercent] = useState("75");

  const selected =
    ALL_COLLATERAL.find((c) => c.code === token) ?? ALL_COLLATERAL[0];

  const { data: currentFactor } = useQuery({
    queryKey: [
      "admin",
      "collateralFactor",
      selected?.contractId,
      selected?.code,
    ],
    queryFn: async () => {
      if (!selected) return 0;
      const tokens = getAvailableTokens();
      const tokenInfo = tokens[selected.code];
      if (!tokenInfo?.contract) return 0;
      return lendingService.getCollateralFactor(
        tokenInfo.contract,
        selected.contractId
      );
    },
    enabled: !!selected,
    staleTime: 30_000,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !selected) return;
    const factorNum = parseFloat(factorPercent);
    if (!Number.isFinite(factorNum) || factorNum < 0 || factorNum > 100) {
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: "Factor must be between 0 and 100",
      });
      return;
    }
    const factor = Number(toSmallestUnit(factorPercent, 7) / 100n); // 7 decimals: 75% = 7_500_000
    if (factor > SCALAR_7) {
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: "Factor cannot exceed 100%",
      });
      return;
    }
    setLoading(true);
    try {
      const tokens = getAvailableTokens();
      const tokenInfo = tokens[selected.code];
      if (!tokenInfo?.contract) {
        addNotification("Error", "error", {
          ...TOAST_CONFIG.defaultOpts,
          description: `Token ${selected.code} not found`,
        });
        return;
      }
      const result = await lendingService.setCollateralFactor(
        {
          token: tokenInfo.contract,
          factor,
          asset_type: selected.assetType,
          symbol: selected.code,
        },
        address,
        selected.contractId
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
        description: `Collateral factor for ${selected.code} set to ${factorPercent}%`,
      });
      void queryClient.invalidateQueries({
        queryKey: [
          "admin",
          "collateralFactor",
          selected.contractId,
          selected.code,
        ],
      });
      void invalidateProtocolQueries(queryClient, ["pools", "positions"]);
    } catch (err) {
      const msg = extractContractErrorOrNull(err);
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description:
          typeof msg === "string" ? msg : "Failed to set collateral factor",
      });
    } finally {
      setLoading(false);
    }
  };

  if (ALL_COLLATERAL.length === 0) return null;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">
        Collateral Factor
      </h2>
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/10 p-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm text-white/70 mb-1">Token</label>
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
            >
              {ALL_COLLATERAL.map((c) => (
                <option key={`${c.poolId}-${c.code}`} value={c.code}>
                  {c.code} ({c.poolId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-white/70 mb-1">
              Factor (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={factorPercent}
              onChange={(e) => setFactorPercent(e.target.value)}
              className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              placeholder="75"
            />
            {currentFactor !== undefined && currentFactor > 0 && (
              <p className="text-xs text-white/50 mt-1">
                Current: {(currentFactor / 100_000).toFixed(2)}%
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-[#229EDF] hover:bg-[#1e8bc9] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Updating..." : "Update"}
          </button>
        </form>
      </div>
    </section>
  );
}
