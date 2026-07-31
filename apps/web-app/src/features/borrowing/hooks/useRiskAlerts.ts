"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RISK_ALERT_STORAGE_VERSION,
  type RiskAlert,
  type BreachStateMap,
  type AlertStorageSchema,
} from "../types/riskAlert";

// ─── Storage helpers ──────────────────────────────────────────────────────────

function storageKey(walletAddress: string): string {
  return `neko_risk_alerts_v${RISK_ALERT_STORAGE_VERSION}_${walletAddress}`;
}

interface AlertState {
  alerts: RiskAlert[];
  /** Persisted per-position breach flags — see `BreachStateMap`. */
  breach: BreachStateMap;
}

const EMPTY: AlertState = { alerts: [], breach: {} };

function loadFromStorage(walletAddress: string): AlertState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as AlertStorageSchema;
    if (parsed.version !== RISK_ALERT_STORAGE_VERSION) return EMPTY;
    return { alerts: parsed.alerts ?? [], breach: parsed.breach ?? {} };
  } catch {
    return EMPTY;
  }
}

function saveToStorage(walletAddress: string, state: AlertState): void {
  if (typeof window === "undefined") return;
  try {
    const schema: AlertStorageSchema = {
      version: RISK_ALERT_STORAGE_VERSION,
      alerts: state.alerts,
      breach: state.breach,
    };
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(schema));
  } catch {
    // Storage quota exceeded or unavailable — fail silently.
  }
}

// ─── Hook public API ──────────────────────────────────────────────────────────

export interface UseRiskAlertsReturn {
  /** All persisted alerts (newest-first ordering is applied by consumers). */
  alerts: RiskAlert[];
  /** Persisted per-position breach flags, used for de-duplication. */
  breach: BreachStateMap;
  addAlert: (alert: RiskAlert) => void;
  dismissAlert: (id: string) => void;
  setBreach: (contractId: string, breached: boolean) => void;
  clearAlerts: () => void;
}

/**
 * Per-wallet durable list of risk alerts plus the breach-state map used to
 * de-duplicate ongoing breaches.  Persisted to localStorage; re-hydrates on
 * wallet change.  Mirrors `features/swap/hooks/useLimitOrders`.
 */
export function useRiskAlerts(
  walletAddress: string | undefined
): UseRiskAlertsReturn {
  const [state, setState] = useState<AlertState>(() =>
    walletAddress ? loadFromStorage(walletAddress) : EMPTY
  );

  // Re-hydrate synchronously when the connected wallet changes using the React
  // "storing information from previous renders" pattern — tracking the loaded
  // wallet in state avoids both a setState-in-effect cascade and touching a ref
  // during render.
  const [loadedWallet, setLoadedWallet] = useState(walletAddress);
  if (loadedWallet !== walletAddress) {
    setLoadedWallet(walletAddress);
    setState(walletAddress ? loadFromStorage(walletAddress) : EMPTY);
  }

  useEffect(() => {
    if (!walletAddress) return;
    saveToStorage(walletAddress, state);
  }, [walletAddress, state]);

  const addAlert = useCallback((alert: RiskAlert) => {
    setState((prev) => ({ ...prev, alerts: [alert, ...prev.alerts] }));
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.id === id ? { ...a, dismissed: true } : a
      ),
    }));
  }, []);

  const setBreach = useCallback((contractId: string, breached: boolean) => {
    setState((prev) => {
      if ((prev.breach[contractId] ?? false) === breached) return prev;
      return { ...prev, breach: { ...prev.breach, [contractId]: breached } };
    });
  }, []);

  const clearAlerts = useCallback(() => setState(EMPTY), []);

  return {
    alerts: state.alerts,
    breach: state.breach,
    addAlert,
    dismissAlert,
    setBreach,
    clearAlerts,
  };
}
