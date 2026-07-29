"use client";

import { useState } from "react";
import { Bell, BellOff, Check, X } from "lucide-react";
import { useRiskAlertContext } from "../../context/RiskAlertContext";

const DEFAULT_THRESHOLD = "1.3";

// Shared pill shape — mirrors HealthFactorBadge so the Alert cell reads as part
// of the same visual system as the "Caution" health-factor badge beside it.
const PILL = "flex items-center gap-2 rounded-lg border px-2.5 py-1.5";
// Amber treatment, matching the "Caution" health-factor badge.
const AMBER = "border-yellow-500/20 bg-yellow-500/10 text-yellow-400";

interface HealthFactorAlertControlProps {
  /** Pool contract id this alert threshold applies to. */
  contractId: string;
}

/**
 * Compact per-position control to set / edit / clear a health-factor alert
 * threshold.  Renders inline in the positions table, styled to match the
 * neighbouring health-factor badge.
 */
export function HealthFactorAlertControl({
  contractId,
}: HealthFactorAlertControlProps) {
  const { thresholds, setThreshold, removeThreshold } = useRiskAlertContext();
  const current = thresholds[contractId];
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    current != null ? String(current) : DEFAULT_THRESHOLD
  );

  function save() {
    const n = parseFloat(value);
    if (Number.isFinite(n) && n > 0) {
      setThreshold(contractId, n);
      setEditing(false);
    }
  }

  function startEditing() {
    setValue(current != null ? String(current) : DEFAULT_THRESHOLD);
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-2">
        <input
          type="number"
          step="0.05"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className={`w-16 rounded-lg border px-2.5 py-1.5 text-center text-sm font-bold outline-none ${AMBER} focus:border-yellow-400/50`}
          autoFocus
          aria-label="Alert threshold health factor"
        />
        <button
          onClick={save}
          className="rounded-lg border border-green-500/20 bg-green-500/10 flex h-[34px] w-[34px] items-center justify-center text-green-400 transition-colors hover:bg-green-500/20"
          aria-label="Save alert threshold"
          title="Save"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-lg border border-white/10 bg-white/5 flex h-[34px] w-[34px] items-center justify-center text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
          aria-label="Cancel"
          title="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (current != null) {
    return (
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={startEditing}
          className={`${PILL} ${AMBER} transition-colors hover:bg-yellow-500/20`}
          title="Edit alert threshold"
        >
          <Bell className="h-3.5 w-3.5 shrink-0" />
          <span className="whitespace-nowrap text-sm font-bold tabular-nums">
            {"< "}
            {current.toFixed(2)}
          </span>
        </button>
        <button
          onClick={() => removeThreshold(contractId)}
          className="rounded-lg border border-white/10 bg-white/5 flex h-[34px] w-[34px] items-center justify-center text-white/40 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
          aria-label="Remove alert threshold"
          title="Remove alert"
        >
          <BellOff className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEditing}
      className={`mx-auto ${PILL} ${AMBER} transition-colors hover:bg-yellow-500/20`}
      title="Set a health-factor alert"
    >
      <Bell className="h-3.5 w-3.5 shrink-0" />
      <span className="whitespace-nowrap text-xs font-semibold">Set alert</span>
    </button>
  );
}
