"use client";

import { useState } from "react";
import { Bell, BellOff, Check, X } from "lucide-react";
import { useRiskAlertContext } from "../../context/RiskAlertContext";

const DEFAULT_THRESHOLD = "1.3";

interface HealthFactorAlertControlProps {
  /** Pool contract id this alert threshold applies to. */
  contractId: string;
}

/**
 * Compact per-position control to set / edit / clear a health-factor alert
 * threshold.  Renders inline in the positions table.
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
      <div className="flex items-center justify-center gap-1">
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
          className="w-16 rounded-md border border-white/10 bg-[#242424] px-2 py-1 text-center text-xs text-white outline-none focus:border-[#229EDF]"
          autoFocus
          aria-label="Alert threshold health factor"
        />
        <button
          onClick={save}
          className="p-1 text-green-400 hover:text-green-300"
          aria-label="Save alert threshold"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setEditing(false)}
          className="p-1 text-white/40 hover:text-white/70"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (current != null) {
    return (
      <div className="flex items-center justify-center gap-1.5">
        <button
          onClick={startEditing}
          className="flex items-center gap-1 rounded-md border border-[#229EDF]/20 bg-[#229EDF]/10 px-2 py-1 text-[11px] text-[#229EDF] hover:bg-[#229EDF]/20"
          title="Edit alert threshold"
        >
          <Bell className="h-3 w-3" />
          {"< "}
          {current.toFixed(2)}
        </button>
        <button
          onClick={() => removeThreshold(contractId)}
          className="p-1 text-white/30 hover:text-red-400"
          aria-label="Remove alert threshold"
        >
          <BellOff className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startEditing}
      className="mx-auto flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/40 hover:border-white/20 hover:text-white/70"
      title="Set a health-factor alert"
    >
      <Bell className="h-3 w-3" />
      Set alert
    </button>
  );
}
