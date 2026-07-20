"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Loader2,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { computeSensitivity } from "@/lib/strategy/engine";
import { getHealthFactorColor } from "@/features/borrowing/const/riskThresholds";
import type {
  ExecutionRecord,
  ExecutionStepRecord,
  RiskAssessment,
  Strategy,
  StrategyProjection,
} from "@/lib/strategy/types";
import { formatBps, formatMultiplier, formatNumber } from "../utils";

// ─── Simulation summary ──────────────────────────────────────────────────────

export interface SimulationSummaryProps {
  projection: StrategyProjection;
}

/** Cumulative fees/slippage/APY/leverage/health factor/liquidation price, plus the per-step breakdown. */
export function SimulationSummary({ projection }: SimulationSummaryProps) {
  if (!projection.success) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
        <p className="font-medium">
          Simulation failed at step &quot;{projection.failedStepId}&quot;
        </p>
        <p className="mt-1 text-red-300/80">{projection.failureReason}</p>
      </div>
    );
  }

  const stats: { label: string; value: string; className?: string }[] = [
    { label: "Cumulative fee", value: `${projection.cumulativeFee} XLM` },
    {
      label: "Cumulative slippage",
      value: formatBps(projection.cumulativeSlippageBps),
    },
    {
      label: "Projected APY",
      value:
        projection.projectedApy != null
          ? `${formatNumber(projection.projectedApy)}%`
          : "—",
    },
    {
      label: "Effective leverage",
      value: formatMultiplier(projection.effectiveLeverage),
    },
    {
      label: "Projected health factor",
      value: formatNumber(projection.projectedHealthFactor),
      className: getHealthFactorColor(projection.projectedHealthFactor),
    },
    {
      label: "Liquidation price",
      value: formatNumber(projection.projectedLiquidationPrice),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
          >
            <p className="text-[11px] uppercase tracking-wide text-white/40">
              {stat.label}
            </p>
            <p
              className={`mt-1 text-lg font-semibold ${stat.className ?? "text-white"}`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Per-step projection
        </h4>
        {Object.entries(projection.steps).map(([stepId, step]) => (
          <div
            key={stepId}
            className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm"
          >
            <span className="text-white/70">{stepId}</span>
            <span className="text-white/50">
              fee {step.estimatedFee}
              {step.slippageBps != null
                ? ` · ${formatBps(step.slippageBps)} slippage`
                : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sensitivity panel ───────────────────────────────────────────────────────

export interface SensitivityPanelProps {
  baseline: StrategyProjection;
}

/** Slippage/market-movement scenario table, computed analytically from a single baseline simulation. */
export function SensitivityPanel({ baseline }: SensitivityPanelProps) {
  const scenarios = useMemo(() => computeSensitivity(baseline), [baseline]);

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-white/40">
            <th className="px-3 py-2">Scenario</th>
            <th className="px-3 py-2">Slippage</th>
            <th className="px-3 py-2">Health factor</th>
            <th className="px-3 py-2">Liquidation price</th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((scenario) => (
            <tr
              key={scenario.label}
              className="border-b border-white/5 last:border-0"
            >
              <td className="px-3 py-2 text-white/80">{scenario.label}</td>
              <td className="px-3 py-2 text-white/60">
                {formatBps(scenario.projection.cumulativeSlippageBps)}
              </td>
              <td className="px-3 py-2 text-white/60">
                {formatNumber(scenario.projection.projectedHealthFactor)}
              </td>
              <td className="px-3 py-2 text-white/60">
                {formatNumber(scenario.projection.projectedLiquidationPrice)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Risk acknowledgement modal ──────────────────────────────────────────────

export interface RiskAcknowledgementModalProps {
  assessment: RiskAssessment;
  onAcknowledge: () => void;
  onCancel: () => void;
}

/** Blocks execution start until the user explicitly acknowledges an over-threshold risk assessment. */
export function RiskAcknowledgementModal({
  assessment,
  onAcknowledge,
  onCancel,
}: RiskAcknowledgementModalProps) {
  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="risk-ack-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-yellow-500/30 bg-[#1C1C1C] p-6">
          <div className="flex items-center gap-2 text-yellow-300">
            <AlertTriangle size={20} />
            <h2 id="risk-ack-title" className="text-base font-semibold">
              This strategy exceeds your safety thresholds
            </h2>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-white/40">Effective leverage</dt>
              <dd className="text-white">
                {formatMultiplier(assessment.effectiveLeverage)}
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Health factor</dt>
              <dd className="text-white">
                {formatNumber(assessment.projectedHealthFactor)}
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Cumulative slippage</dt>
              <dd className="text-white">
                {formatBps(assessment.cumulativeSlippageBps)}
              </dd>
            </div>
            <div>
              <dt className="text-white/40">Risk tier</dt>
              <dd className="text-white capitalize">{assessment.riskTier}</dd>
            </div>
          </dl>

          <p className="mt-4 text-sm text-white/60">
            Proceeding executes real on-chain transactions at this risk level.
            Confirm you understand the risk before continuing.
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onAcknowledge}
              className="rounded-full bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400"
            >
              I understand the risk, proceed
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ─── Execution progress ──────────────────────────────────────────────────────

export interface ExecutionProgressProps {
  strategy: Strategy;
  execution: ExecutionRecord;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending: <CircleDashed size={16} className="text-white/30" />,
  preparing: <Loader2 size={16} className="animate-spin text-[#229EDF]" />,
  awaiting_signature: (
    <Loader2 size={16} className="animate-spin text-[#229EDF]" />
  ),
  submitting: <Loader2 size={16} className="animate-spin text-[#229EDF]" />,
  confirming: <Loader2 size={16} className="animate-spin text-[#229EDF]" />,
  completed: <CheckCircle2 size={16} className="text-green-400" />,
  failed: <XCircle size={16} className="text-red-400" />,
  paused_deviation: <PauseCircle size={16} className="text-yellow-400" />,
  cancelled: <XCircle size={16} className="text-white/30" />,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing transaction",
  awaiting_signature: "Awaiting your signature",
  submitting: "Submitting",
  confirming: "Confirming on-chain",
  completed: "Completed",
  failed: "Failed",
  paused_deviation: "Paused — result deviated from projection",
  cancelled: "Cancelled",
};

/** Step-by-step guided execution status: prepare / sign / submit / confirm per step. */
export function ExecutionProgress({
  strategy,
  execution,
}: ExecutionProgressProps) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Execution progress">
      {strategy.steps.map((step, i) => {
        const record = execution.steps.find((s) => s.stepId === step.id);
        const status = record?.status ?? "pending";
        return (
          <li
            key={step.id}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1C1C1C] p-3"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs text-white/50">
              {i + 1}
            </span>
            {STATUS_ICON[status]}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">{step.label}</p>
              <p className="truncate text-xs text-white/40">
                {STATUS_LABEL[status]}
                {record?.txHash ? ` · ${record.txHash.slice(0, 8)}…` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Deviation pause modal ────────────────────────────────────────────────────

export interface DeviationPauseModalProps {
  step: ExecutionStepRecord;
  stepLabel: string;
  onResume: () => void;
  onAbandon: () => void;
}

/** Shown when a step's confirmed on-chain result deviates beyond threshold from its projection. */
export function DeviationPauseModal({
  step,
  stepLabel,
  onResume,
  onAbandon,
}: DeviationPauseModalProps) {
  const deviation = step.deviation;

  return (
    <ModalPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deviation-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-yellow-500/30 bg-[#1C1C1C] p-6">
          <div className="flex items-center gap-2 text-yellow-300">
            <PauseCircle size={20} />
            <h2 id="deviation-title" className="text-base font-semibold">
              Execution paused: &quot;{stepLabel}&quot; deviated from projection
            </h2>
          </div>

          <p className="mt-3 text-sm text-white/70">
            {deviation?.message ??
              "This step's on-chain result differs significantly from what was simulated."}
          </p>

          {deviation && (
            <p className="mt-2 text-xs text-white/40">
              Deviation: {((deviation.relativeDeviation ?? 0) * 100).toFixed(1)}
              % (threshold {(deviation.threshold * 100).toFixed(1)}%)
            </p>
          )}

          <p className="mt-4 text-sm text-white/60">
            The remaining steps have not run. Resume to continue with the actual
            result, or abandon this execution (the transactions already
            submitted stay on-chain and in your history either way).
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onAbandon}
              className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white"
            >
              Abandon
            </button>
            <button
              type="button"
              onClick={onResume}
              className="rounded-full bg-[#229EDF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1c8bc4]"
            >
              Resume anyway
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
