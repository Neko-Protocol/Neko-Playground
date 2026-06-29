"use client";

import React from "react";
import type { StrategyRule } from "../../types/automation";

interface Props {
  rule: StrategyRule;
  onChange: (rule: StrategyRule) => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-white/60">{label}</label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step ?? 1}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
    />
  );
}

export function RuleEditor({ rule, onChange }: Props) {
  const set = <K extends keyof StrategyRule>(key: K, value: StrategyRule[K]) =>
    onChange({ ...rule, [key]: value });

  const setConstraint = <K extends keyof StrategyRule["constraints"]>(
    key: K,
    value: StrategyRule["constraints"][K]
  ) =>
    onChange({ ...rule, constraints: { ...rule.constraints, [key]: value } });

  const setGuard = <K extends keyof StrategyRule["guards"]>(
    key: K,
    value: StrategyRule["guards"][K]
  ) => onChange({ ...rule, guards: { ...rule.guards, [key]: value } });

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">Trigger</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Trigger type">
            <select
              value={rule.trigger}
              onChange={(e) =>
                set("trigger", e.target.value as StrategyRule["trigger"])
              }
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            >
              <option value="threshold">APY threshold</option>
              <option value="schedule">Schedule</option>
              <option value="both">Both</option>
            </select>
          </Field>
          <Field label="Min improvement (bps)">
            <NumInput
              value={rule.improvementThresholdBps}
              onChange={(v) => set("improvementThresholdBps", v)}
              min={1}
            />
          </Field>
          <Field label="Schedule interval (min)">
            <NumInput
              value={rule.scheduleIntervalMs / 60_000}
              onChange={(v) => set("scheduleIntervalMs", v * 60_000)}
              min={1}
              step={5}
            />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">
          Allocation constraints
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Min position size (USD)">
            <NumInput
              value={rule.constraints.minPositionUsd}
              onChange={(v) => setConstraint("minPositionUsd", v)}
              min={1}
            />
          </Field>
          <Field label="Max venues">
            <NumInput
              value={rule.constraints.maxVenueCount}
              onChange={(v) => setConstraint("maxVenueCount", v)}
              min={1}
              max={20}
            />
          </Field>
          <Field label="Reserve buffer (%)">
            <NumInput
              value={rule.constraints.reserveBufferPct}
              onChange={(v) => setConstraint("reserveBufferPct", v)}
              min={0}
              max={99}
            />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">
          Risk guards
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Stop-loss (%)">
            <NumInput
              value={rule.guards.stopLossPct}
              onChange={(v) => setGuard("stopLossPct", v)}
              min={1}
              max={100}
            />
          </Field>
          <Field label="Take-profit (%)">
            <NumInput
              value={rule.guards.takeProfitPct}
              onChange={(v) => setGuard("takeProfitPct", v)}
              min={1}
            />
          </Field>
          <Field label="Min health factor">
            <NumInput
              value={rule.guards.minHealthFactor}
              onChange={(v) => setGuard("minHealthFactor", v)}
              min={1}
              step={0.1}
            />
          </Field>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">Execution</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Slippage tolerance (%)">
            <NumInput
              value={rule.slippageTolerancePct}
              onChange={(v) => set("slippageTolerancePct", v)}
              min={0.1}
              max={50}
              step={0.1}
            />
          </Field>
          <Field label="Auto-execute">
            <label className="flex cursor-pointer items-center gap-2 py-2">
              <input
                type="checkbox"
                checked={rule.autoExecute}
                onChange={(e) => set("autoExecute", e.target.checked)}
                className="h-4 w-4 rounded border-white/20 accent-blue-500"
              />
              <span className="text-sm text-white/70">
                Skip confirmation step
              </span>
            </label>
          </Field>
        </div>
      </section>
    </div>
  );
}
