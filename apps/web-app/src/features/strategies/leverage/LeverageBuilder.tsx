"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ShieldCheck } from "lucide-react";
import { getRwaTokenCodes } from "@/lib/constants/assets.config";
import { HF_DANGER_ZONE } from "@/features/borrowing/const/riskThresholds";
import {
  DEFAULT_LEVERAGE_BORROW_ASSET,
  useLeverageBuilder,
} from "./useLeverageBuilder";
import { useOpenLeveragePosition } from "./useOpenLeveragePosition";
import { ExecutionProgress } from "../components/ExecutionUI";
import { buildLeverageStrategy } from "@/lib/strategy/leverage/buildStrategy";
import type { OpenLeveragePositionResult } from "./useOpenLeveragePosition";

export interface LeverageBuilderProps {
  initialAssetCode?: string;
  onClose: () => void;
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * The leverage builder (Scope §1-2-7): pick an RWA asset and target
 * multiple, review the routed loop's pre-trade simulation, and open the
 * position — composed onto the existing strategy engine
 * (useOpenLeveragePosition), with the same step-by-step ExecutionProgress
 * view the generic StrategyComposer uses.
 */
export function LeverageBuilder({
  initialAssetCode,
  onClose,
}: LeverageBuilderProps) {
  const rwaAssets = useMemo(() => getRwaTokenCodes(), []);
  const [assetCode, setAssetCode] = useState(
    initialAssetCode ?? rwaAssets[0] ?? ""
  );
  const [initialCollateralAmount, setInitialCollateralAmount] = useState("100");
  const [targetMultiple, setTargetMultiple] = useState(2);
  const [safetyBufferPct, setSafetyBufferPct] = useState(5);
  const [grantDelegation, setGrantDelegation] = useState(true);
  const [deleverageThreshold, setDeleverageThreshold] = useState(
    HF_DANGER_ZONE + 0.05
  );
  const [hysteresis, setHysteresis] = useState(0.05);
  const [result, setResult] = useState<OpenLeveragePositionResult | null>(null);

  const builderInput = useMemo(
    () => ({
      assetCode,
      borrowAssetCode: DEFAULT_LEVERAGE_BORROW_ASSET,
      initialCollateralAmount,
      targetMultiple,
      safetyBufferPct,
    }),
    [assetCode, initialCollateralAmount, targetMultiple, safetyBufferPct]
  );

  const { route, isLoading, borrowAssetCode, candidatePoolCount } =
    useLeverageBuilder(assetCode ? builderInput : null);
  const { open, isOpening, hasWallet } = useOpenLeveragePosition();

  const previewStrategy = useMemo(() => {
    if (!route || !route.ok) return null;
    return buildLeverageStrategy(
      {
        route,
        assetCode,
        borrowAssetCode,
        initialCollateralAmount,
      },
      targetMultiple,
      1, // achievedMultiple isn't needed for the step preview, only the steps
      safetyBufferPct
    );
  }, [
    route,
    assetCode,
    borrowAssetCode,
    initialCollateralAmount,
    targetMultiple,
    safetyBufferPct,
  ]);

  const canOpen =
    hasWallet && !isOpening && route?.ok === true && !result?.execution;

  const handleOpen = async () => {
    if (!route || !route.ok) return;
    const outcome = await open({
      route,
      assetCode,
      borrowAssetCode,
      initialCollateralAmount,
      targetMultiple,
      safetyBufferPct,
      grantDelegation,
      deleverageThreshold,
      hysteresis,
    });
    if (outcome) setResult(outcome);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to strategies"
          className="rounded-full p-2 text-white/50 hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
        <h2 className="text-lg font-semibold text-white">Leverage builder</h2>
      </div>

      {result?.execution ? (
        <div className="flex flex-col gap-4">
          <ExecutionProgress
            strategy={result.strategy}
            execution={result.execution}
          />
          {result.grant && (
            <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
              <ShieldCheck size={16} />
              Automated deleveraging is enabled for this position — manage it
              from the position card on your Dashboard.
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="self-end rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
          >
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              RWA asset
              <select
                value={assetCode}
                onChange={(e) => setAssetCode(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-white"
              >
                {rwaAssets.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              Initial collateral ({assetCode || "asset"})
              <input
                type="number"
                min="0"
                step="any"
                value={initialCollateralAmount}
                onChange={(e) => setInitialCollateralAmount(e.target.value)}
                className="rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-white"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              Target multiple
              <input
                type="number"
                min="1.01"
                step="0.1"
                value={targetMultiple}
                onChange={(e) => setTargetMultiple(Number(e.target.value))}
                className="rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-white"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm text-white/70">
              Safety buffer below max LTV (%)
              <input
                type="number"
                min="0"
                step="0.5"
                value={safetyBufferPct}
                onChange={(e) => setSafetyBufferPct(Number(e.target.value))}
                className="rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-white"
              />
            </label>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <label className="flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={grantDelegation}
                onChange={(e) => setGrantDelegation(e.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-transparent"
              />
              Enable automated deleveraging
            </label>
            <p className="mt-1 text-xs text-white/40">
              Signs a bounded set of partial-unwind transactions now, so the
              coordinator can repay and free collateral automatically if health
              factor drops below your threshold — never more than needed to
              clear the breach, and revocable anytime.
            </p>
            {grantDelegation && (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs text-white/60">
                  Auto-unwind health factor threshold
                  <input
                    type="number"
                    min="1.01"
                    step="0.05"
                    value={deleverageThreshold}
                    onChange={(e) =>
                      setDeleverageThreshold(Number(e.target.value))
                    }
                    className="rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-white"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-white/60">
                  Recovery hysteresis
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hysteresis}
                    onChange={(e) => setHysteresis(Number(e.target.value))}
                    className="rounded-lg border border-white/10 bg-[#121212] px-3 py-2 text-white"
                  />
                </label>
              </div>
            )}
          </div>

          {isLoading && (
            <p className="text-sm text-white/40">
              Evaluating {candidatePoolCount} eligible pools…
            </p>
          )}

          {route && !route.ok && (
            <div
              className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
              role="alert"
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{route.reason}</span>
            </div>
          )}

          {route?.ok && (
            <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-sm font-semibold text-white">
                Route simulation
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-xs text-white/40">Iterations</p>
                  <p className="text-white">{route.iterations.length}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Blended entry price</p>
                  <p className="text-white">
                    {route.simulation.blendedEntryPrice != null
                      ? `$${route.simulation.blendedEntryPrice.toFixed(4)}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Blended borrow cost</p>
                  <p className="text-white">
                    {formatPct(route.simulation.totalBorrowCostPct)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-white/40">Total slippage</p>
                  <p className="text-white">
                    {(route.simulation.totalSlippageBps / 100).toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-xs">
                  <thead>
                    <tr className="text-white/40">
                      <th className="py-1 pr-3">#</th>
                      <th className="py-1 pr-3">Pool</th>
                      <th className="py-1 pr-3">Deposit</th>
                      <th className="py-1 pr-3">Borrow</th>
                      <th className="py-1 pr-3">Swap out</th>
                      <th className="py-1">Slippage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {route.iterations.map((it) => (
                      <tr key={it.index} className="text-white/70">
                        <td className="py-1 pr-3">{it.index}</td>
                        <td className="py-1 pr-3">{it.poolType}</td>
                        <td className="py-1 pr-3">{it.depositAmount}</td>
                        <td className="py-1 pr-3">{it.borrowAmount}</td>
                        <td className="py-1 pr-3">{it.swapAmountOut}</td>
                        <td className="py-1">
                          {(it.swapPriceImpactBps / 100).toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {previewStrategy && (
                <details className="text-xs text-white/50">
                  <summary className="cursor-pointer text-white/70">
                    Preview {previewStrategy.steps.length} strategy steps
                  </summary>
                  <ol className="mt-2 flex flex-col gap-1">
                    {previewStrategy.steps.map((step, i) => (
                      <li key={step.id}>
                        {i + 1}. {step.label}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleOpen()}
              disabled={!canOpen}
              className="rounded-full bg-[#229EDF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1c8bc4] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isOpening ? "Opening…" : "Open leveraged position"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default LeverageBuilder;
