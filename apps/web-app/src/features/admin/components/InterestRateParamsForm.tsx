"use client";

import React, { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { lendingService } from "@/lib/services/lending.service";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import { rpcUrl } from "@/lib/constants/network";
import { POOLS } from "../constants";
import { TOAST_CONFIG } from "@/lib/constants/toast.config";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import { invalidateProtocolQueries } from "@/lib/helpers/invalidateProtocolQueries";
import { toSmallestUnit } from "@/lib/helpers/tokenUtils";
import { Networks } from "@stellar/stellar-sdk";
import { useQueryClient } from "@tanstack/react-query";
import type { InterestRateParams } from "@neko/lending";
import { useQueuedReserveParams } from "../hooks/useQueuedReserveParams";

const SCALAR_7 = 10_000_000;

/** Convert a percentage string (e.g. "75") to a 7-decimal scalar (7_500_000). */
function pctTo7(pctStr: string): number {
  return Number(toSmallestUnit(pctStr, 7) / 100n);
}

function formatRemaining(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const secs = seconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  return `${minutes}m ${secs}s`;
}

export default function InterestRateParamsForm() {
  const { address, signTransaction, networkPassphrase } = useWallet();
  const { addNotification } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: "apply" | "cancel";
    asset: string;
  } | null>(null);
  const [poolId, setPoolId] = useState<"pool1" | "pool2">("pool1");
  const [asset, setAsset] = useState("USDC");
  const [targetUtil, setTargetUtil] = useState("75");
  const [maxUtil, setMaxUtil] = useState("95");
  const [rBase, setRBase] = useState("1");
  const [rOne, setROne] = useState("5");
  const [rTwo, setRTwo] = useState("50");
  const [rThree, setRThree] = useState("150");
  const [reactivity, setReactivity] = useState("0.00002");
  const [enabled, setEnabled] = useState(true);
  const [lFactor, setLFactor] = useState("80");
  const [supplyCap, setSupplyCap] = useState("0");

  const pool = POOLS.find((p) => p.id === poolId) ?? POOLS[0];
  const assets = pool.assets;
  const queuedReserveParams = useQueuedReserveParams(pool.contractId, assets);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    const params: InterestRateParams = {
      target_util: pctTo7(targetUtil),
      max_util: pctTo7(maxUtil),
      r_base: pctTo7(rBase),
      r_one: pctTo7(rOne),
      r_two: pctTo7(rTwo),
      r_three: pctTo7(rThree),
      reactivity: Number(toSmallestUnit(reactivity, 7)),
      enabled,
      l_factor: pctTo7(lFactor),
      supply_cap: toSmallestUnit(supplyCap, 7),
    };

    if (params.target_util > 9_500_000) {
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: "target_util must be <= 95%",
      });
      return;
    }
    if (params.max_util <= params.target_util || params.max_util > SCALAR_7) {
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description: "max_util must be > target_util and <= 100%",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await lendingService.setInterestRateParams(
        asset,
        params,
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
        description: `Interest rate params for ${asset} queued`,
      });
      await queryClient.invalidateQueries({
        queryKey: ["queued-reserve-params", pool.contractId],
      });
      void invalidateProtocolQueries(queryClient, [
        "pools",
        "rates",
        "positions",
      ]);
    } catch (err) {
      const msg = extractContractErrorOrNull(err);
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description:
          typeof msg === "string" ? msg : "Failed to set interest rate params",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePendingAction = async (
    action: "apply" | "cancel",
    targetAsset: string
  ) => {
    if (!address) return;

    setPendingAction({ action, asset: targetAsset });
    try {
      const result =
        action === "apply"
          ? await lendingService.applyQueuedReserveParams(
              targetAsset,
              address,
              pool.contractId
            )
          : await lendingService.cancelQueuedReserveParams(
              targetAsset,
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
        description:
          action === "apply"
            ? `Queued interest rate params for ${targetAsset} applied`
            : `Queued interest rate params for ${targetAsset} cancelled`,
      });

      await queryClient.invalidateQueries({
        queryKey: ["queued-reserve-params", pool.contractId],
      });
      void invalidateProtocolQueries(queryClient, [
        "pools",
        "rates",
        "positions",
      ]);
    } catch (err) {
      const msg = extractContractErrorOrNull(err);
      addNotification("Error", "error", {
        ...TOAST_CONFIG.defaultOpts,
        description:
          typeof msg === "string"
            ? msg
            : `Failed to ${action} queued interest rate params`,
      });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">
        Interest Rate Params
      </h2>
      <div className="rounded-2xl bg-[#1C1C1C] border border-white/10 p-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Pool</label>
              <select
                value={poolId}
                onChange={(e) => {
                  setPoolId(e.target.value as "pool1" | "pool2");
                  const p = POOLS.find((x) => x.id === e.target.value);
                  if (p && p.assets.length > 0 && !p.assets.includes(asset)) {
                    setAsset(p.assets[0]);
                  }
                }}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              >
                {POOLS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Asset</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              >
                {assets.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                target_util (%)
              </label>
              <input
                type="number"
                min="0"
                max="95"
                step="0.1"
                value={targetUtil}
                onChange={(e) => setTargetUtil(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                max_util (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={maxUtil}
                onChange={(e) => setMaxUtil(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                r_base (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rBase}
                onChange={(e) => setRBase(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                r_one (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rOne}
                onChange={(e) => setROne(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                r_two (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={rTwo}
                onChange={(e) => setRTwo(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                r_three (%)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={rThree}
                onChange={(e) => setRThree(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1">
              reactivity
            </label>
            <input
              type="number"
              min="0"
              step="0.00001"
              value={reactivity}
              onChange={(e) => setReactivity(e.target.value)}
              className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">
                l_factor (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={lFactor}
                onChange={(e) => setLFactor(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">
                supply_cap (0 = unlimited)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={supplyCap}
                onChange={(e) => setSupplyCap(e.target.value)}
                className="w-full rounded-xl bg-[#2A2A2A] border border-white/10 px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-[#229EDF]"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-white/10 bg-[#2A2A2A] text-[#229EDF] focus:ring-[#229EDF]"
            />
            <label htmlFor="enabled" className="text-sm text-white/70">
              Enabled (accept deposits & borrows)
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-[#229EDF] hover:bg-[#1e8bc9] text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Queuing..." : "Queue change"}
          </button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-white">
                Pending reserve changes
              </h3>
              <p className="text-sm text-white/50 mt-1">
                Apply after the timelock unlocks, or cancel while it is still
                locked.
              </p>
            </div>
            <button
              type="button"
              onClick={() => queuedReserveParams.refetch()}
              disabled={queuedReserveParams.isFetching}
              className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-white/70 hover:text-white hover:border-white/20 disabled:opacity-50"
            >
              {queuedReserveParams.isFetching ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {queuedReserveParams.isError ? (
            <div className="rounded-xl border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">
              Pending state could not be loaded from contract storage. Refresh
              before applying or cancelling a change.
            </div>
          ) : queuedReserveParams.isLoading ? (
            <div className="text-sm text-white/50">Loading pending changes...</div>
          ) : queuedReserveParams.data.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#242424] px-4 py-3 text-sm text-white/60">
              No reserve parameter change is currently queued for this pool.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-white/[0.03] text-left text-white/50">
                  <tr>
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Unlocks</th>
                    <th className="px-4 py-3 font-medium text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {queuedReserveParams.data.map((pending) => {
                    const busy =
                      pendingAction?.asset === pending.asset &&
                      pendingAction !== null;
                    return (
                      <tr key={pending.asset} className="text-white/80">
                        <td className="px-4 py-3 font-medium text-white">
                          {pending.asset}
                        </td>
                        <td className="px-4 py-3">
                          {pending.status === "ready" ? (
                            <span className="text-emerald-300">
                              Ready to apply
                            </span>
                          ) : (
                            <span className="text-amber-200">
                              Locked · {formatRemaining(pending.remainingSeconds)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-white/60">
                          {new Date(
                            pending.unlockTime * 1_000
                          ).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handlePendingAction("cancel", pending.asset)
                              }
                              disabled={
                                pending.status !== "locked" ||
                                pendingAction !== null
                              }
                              className="px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:text-white hover:border-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {busy && pendingAction?.action === "cancel"
                                ? "Cancelling..."
                                : "Cancel"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handlePendingAction("apply", pending.asset)
                              }
                              disabled={
                                pending.status !== "ready" ||
                                pendingAction !== null
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#229EDF] hover:bg-[#1e8bc9] text-white disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {busy && pendingAction?.action === "apply"
                                ? "Applying..."
                                : "Apply"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
