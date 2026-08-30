"use client";

import React from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ExecutionStep,
  RebalancePlan,
  StepStatus,
} from "../../types/automation";

interface Props {
  plans: RebalancePlan[];
  isLoading?: boolean;
  onCancel?: (planId: string) => void;
  isCancelling?: boolean;
}

const STATUS_ICON: Record<StepStatus, React.ReactNode> = {
  pending: <Clock size={14} className="text-white/40" />,
  simulating: <Loader2 size={14} className="animate-spin text-blue-400" />,
  "awaiting-signature": (
    <Loader2 size={14} className="animate-spin text-yellow-400" />
  ),
  submitted: <Loader2 size={14} className="animate-spin text-blue-400" />,
  confirmed: <CheckCircle size={14} className="text-green-400" />,
  failed: <XCircle size={14} className="text-red-400" />,
  skipped: <Clock size={14} className="text-white/20" />,
};

const STATUS_LABEL: Record<StepStatus, string> = {
  pending: "Pending",
  simulating: "Simulating",
  "awaiting-signature": "Sign required",
  submitted: "Submitted",
  confirmed: "Confirmed",
  failed: "Failed",
  skipped: "Skipped",
};

function StepRow({ step }: { step: ExecutionStep }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5">
      <span className="w-5 text-center text-xs text-white/30">
        {step.index + 1}
      </span>
      {STATUS_ICON[step.status]}
      <span className="flex-1 text-sm text-white capitalize">{step.kind}</span>
      <span className="text-sm text-white/60">{step.asset}</span>
      <span className="text-sm text-white/60">
        ${step.amountUsd.toFixed(2)}
      </span>
      <span
        className={cn(
          "text-xs",
          step.status === "confirmed"
            ? "text-green-400"
            : step.status === "failed"
              ? "text-red-400"
              : "text-white/40"
        )}
      >
        {STATUS_LABEL[step.status]}
      </span>
      {step.txHash && (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${step.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="text-white/30 hover:text-blue-400"
        >
          <ExternalLink size={12} />
        </a>
      )}
      {step.status === "failed" && step.error && (
        <span
          className="max-w-[16rem] truncate text-xs text-red-400/80"
          title={step.error}
        >
          {step.error}
        </span>
      )}
    </div>
  );
}

export function ExecutionQueueMonitor({
  plans,
  isLoading,
  onCancel,
  isCancelling,
}: Props) {
  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-xl bg-white/5" />;
  }

  const activePlans = plans.filter(
    (p) =>
      p.status === "executing" ||
      p.status === "confirmed" ||
      p.status === "failed"
  );

  if (activePlans.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
        No active execution plans.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activePlans.map((plan) => (
        <div
          key={plan.id}
          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-medium text-white">
              {plan.triggerReason}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                plan.status === "executing"
                  ? "bg-blue-500/20 text-blue-400"
                  : plan.status === "failed"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-green-500/20 text-green-400"
              )}
            >
              {plan.status}
            </span>
          </div>
          <div className="space-y-1.5">
            {plan.steps.map((step) => (
              <StepRow key={step.id} step={step} />
            ))}
          </div>
          {plan.status === "failed" && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-red-500/10 px-3 py-2">
              <span className="text-xs text-red-400">
                {plan.steps.find((s) => s.status === "failed")?.error ??
                  "A step in this plan failed."}
              </span>
              {onCancel && (
                <button
                  onClick={() => onCancel(plan.id)}
                  disabled={isCancelling}
                  className="ml-3 shrink-0 rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 disabled:opacity-50"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
