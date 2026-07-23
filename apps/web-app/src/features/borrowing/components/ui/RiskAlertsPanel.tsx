"use client";

import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { useRiskAlertContext } from "../../context/RiskAlertContext";
import type { RiskAlert } from "../../types/riskAlert";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function describe(alert: RiskAlert): string {
  if (alert.kind === "danger-zone") return "entered the danger zone";
  if (alert.thresholdAtBreach != null) {
    return `dropped below ${alert.thresholdAtBreach.toFixed(2)}`;
  }
  return "breached its threshold";
}

/**
 * Durable, dismissible list of borrow-position risk alerts.  Rendered on the
 * borrowing page; hidden entirely when there are no active alerts.
 */
export function RiskAlertsPanel() {
  const { activeAlerts, dismissAlert } = useRiskAlertContext();

  if (activeAlerts.length === 0) return null;

  return (
    <div className="mb-6 w-full rounded-2xl border border-red-500/20 bg-red-500/5">
      <div className="flex items-center gap-2 border-b border-red-500/15 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-red-300">
          Risk Alerts ({activeAlerts.length})
        </span>
      </div>
      <ul className="divide-y divide-white/5">
        {activeAlerts.map((alert) => (
          <li
            key={alert.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ShieldAlert
                className={`h-4 w-4 shrink-0 ${
                  alert.kind === "danger-zone"
                    ? "text-red-400"
                    : "text-yellow-400"
                }`}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {alert.poolLabel} {describe(alert)} — health factor{" "}
                  {alert.healthFactorAtBreach.toFixed(2)}
                </p>
                <p className="text-xs text-white/40">
                  {formatTime(alert.createdAt)}
                </p>
              </div>
            </div>
            <button
              onClick={() => dismissAlert(alert.id)}
              className="shrink-0 p-1.5 text-white/40 transition-colors hover:text-white"
              aria-label="Dismiss alert"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
