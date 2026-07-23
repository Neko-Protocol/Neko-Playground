"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RISK_THRESHOLD_STORAGE_VERSION,
  type ThresholdMap,
  type ThresholdStorageSchema,
} from "../types/riskAlert";

// ─── Storage helpers ──────────────────────────────────────────────────────────

function storageKey(walletAddress: string): string {
  return `neko_risk_thresholds_v${RISK_THRESHOLD_STORAGE_VERSION}_${walletAddress}`;
}

function loadFromStorage(walletAddress: string): ThresholdMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ThresholdStorageSchema;
    if (parsed.version !== RISK_THRESHOLD_STORAGE_VERSION) return {};
    return parsed.thresholds ?? {};
  } catch {
    return {};
  }
}

function saveToStorage(walletAddress: string, thresholds: ThresholdMap): void {
  if (typeof window === "undefined") return;
  try {
    const schema: ThresholdStorageSchema = {
      version: RISK_THRESHOLD_STORAGE_VERSION,
      thresholds,
    };
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(schema));
  } catch {
    // Storage quota exceeded or unavailable — fail silently.
  }
}

// ─── Hook public API ──────────────────────────────────────────────────────────

export interface UseRiskThresholdsReturn {
  /** Map of pool contract id → configured alert threshold. */
  thresholds: ThresholdMap;
  setThreshold: (contractId: string, value: number) => void;
  removeThreshold: (contractId: string) => void;
  clearThresholds: () => void;
}

/**
 * Per-wallet, per-position health-factor alert thresholds, persisted to
 * localStorage.  Re-hydrates on wallet change; persists on every mutation.
 * Mirrors the storage pattern of `features/swap/hooks/useLimitOrders`.
 */
export function useRiskThresholds(
  walletAddress: string | undefined
): UseRiskThresholdsReturn {
  const [thresholds, setThresholds] = useState<ThresholdMap>(() =>
    walletAddress ? loadFromStorage(walletAddress) : {}
  );

  // Re-hydrate synchronously when the connected wallet changes (connect /
  // switch / disconnect) using the React "storing information from previous
  // renders" pattern — tracking the loaded wallet in state avoids both a
  // setState-in-effect cascade and touching a ref during render.
  const [loadedWallet, setLoadedWallet] = useState(walletAddress);
  if (loadedWallet !== walletAddress) {
    setLoadedWallet(walletAddress);
    setThresholds(walletAddress ? loadFromStorage(walletAddress) : {});
  }

  // Persist to localStorage whenever thresholds change.
  useEffect(() => {
    if (!walletAddress) return;
    saveToStorage(walletAddress, thresholds);
  }, [walletAddress, thresholds]);

  const setThreshold = useCallback((contractId: string, value: number) => {
    setThresholds((prev) => ({ ...prev, [contractId]: value }));
  }, []);

  const removeThreshold = useCallback((contractId: string) => {
    setThresholds((prev) => {
      if (!(contractId in prev)) return prev;
      const next = { ...prev };
      delete next[contractId];
      return next;
    });
  }, []);

  const clearThresholds = useCallback(() => setThresholds({}), []);

  return { thresholds, setThreshold, removeThreshold, clearThresholds };
}
