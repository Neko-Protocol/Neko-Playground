"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useWallet } from "@/hooks/useWallet";
import { useHealthFactor } from "../hooks/useHealthFactor";
import { useRiskThresholds } from "../hooks/useRiskThresholds";
import { useRiskAlerts } from "../hooks/useRiskAlerts";
import {
  evaluatePosition,
  getEffectiveThreshold,
} from "../utils/riskEvaluator";
import { HF_DANGER_ZONE } from "../const/riskThresholds";
import type { RiskAlert, ThresholdMap } from "../types/riskAlert";

// ─── Context shape ────────────────────────────────────────────────────────────

interface RiskAlertContextValue {
  /** Configured thresholds keyed by pool contract id. */
  thresholds: ThresholdMap;
  setThreshold: (contractId: string, value: number) => void;
  removeThreshold: (contractId: string) => void;
  /** Undismissed alerts, newest first. */
  activeAlerts: RiskAlert[];
  /** Every alert (including dismissed), newest first. */
  allAlerts: RiskAlert[];
  dismissAlert: (id: string) => void;
  /** True when any open position is currently below its effective threshold. */
  hasActiveBreach: boolean;
  /** Contract ids currently in breach (live). */
  breachContractIds: string[];
}

const RiskAlertContext = createContext<RiskAlertContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Mounts the borrow-position risk evaluator app-wide so alerts are recorded and
 * the sidebar indicator stays live even when the user is not on the borrowing
 * page.  Polling is delegated to React Query (`useHealthFactor` refetches every
 * 15s and is disabled without a connected wallet); the evaluation effect
 * no-ops when there are no open positions, so no extra timers are created.
 */
export function RiskAlertProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const { pools } = useHealthFactor(address ?? undefined);
  const { thresholds, setThreshold, removeThreshold } = useRiskThresholds(
    address ?? undefined
  );
  const { alerts, breach, addAlert, dismissAlert, setBreach } = useRiskAlerts(
    address ?? undefined
  );

  // Mirror latest state into refs so the evaluation effect can read current
  // values without depending on them (its own writes must not re-trigger it).
  const breachRef = useRef(breach);
  breachRef.current = breach;
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

  // A signature that changes only when a pool's health factor actually changes,
  // so the effect runs on real HF updates rather than every render.
  const hfSignature = pools
    .map((p) => `${p.contractId}:${p.healthFactor ?? "x"}`)
    .join("|");

  // Also re-evaluate when thresholds change, so setting/editing a threshold that
  // is already breached raises the alert immediately instead of on the next
  // poll tick.
  const thresholdSignature = Object.entries(thresholds)
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join("|");

  useEffect(() => {
    if (!address) return;
    const open = pools.filter((p) => p.healthFactor !== null);
    if (open.length === 0) return; // no open positions → evaluator idles

    for (const pool of open) {
      const userThreshold = thresholdsRef.current[pool.contractId] ?? null;
      const prevBreached = breachRef.current[pool.contractId] ?? false;
      const result = evaluatePosition({
        healthFactor: pool.healthFactor,
        userThreshold,
        prevBreached,
      });

      if (result.shouldAlert) {
        const alert: RiskAlert = {
          id: crypto.randomUUID(),
          contractId: pool.contractId,
          poolLabel: pool.label,
          kind: result.kind,
          healthFactorAtBreach: pool.healthFactor as number,
          thresholdAtBreach: userThreshold,
          createdAt: Date.now(),
          dismissed: false,
        };
        addAlert(alert);
      }
      if (result.nextBreached !== prevBreached) {
        // Update the ref synchronously so a re-entrant evaluation — React
        // StrictMode's double-invoke in dev, or overlapping HF/threshold dep
        // changes before the next render — sees the new breach state and does
        // not create a duplicate alert for the same ongoing breach.
        breachRef.current = {
          ...breachRef.current,
          [pool.contractId]: result.nextBreached,
        };
        setBreach(pool.contractId, result.nextBreached);
      }
    }
    // `pools`, `addAlert`, `setBreach` are stable or captured via refs/signature.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, hfSignature, thresholdSignature]);

  // Live "currently in breach" derivation for the sidebar indicator.
  const breachContractIds = useMemo(() => {
    return pools
      .filter((p) => {
        if (p.healthFactor === null) return false;
        const eff = getEffectiveThreshold(
          thresholds[p.contractId] ?? null,
          HF_DANGER_ZONE
        );
        return p.healthFactor < eff;
      })
      .map((p) => p.contractId);
  }, [pools, thresholds]);

  const value = useMemo<RiskAlertContextValue>(() => {
    const sorted = [...alerts].sort((a, b) => b.createdAt - a.createdAt);
    return {
      thresholds,
      setThreshold,
      removeThreshold,
      activeAlerts: sorted.filter((a) => !a.dismissed),
      allAlerts: sorted,
      dismissAlert,
      hasActiveBreach: breachContractIds.length > 0,
      breachContractIds,
    };
  }, [
    alerts,
    thresholds,
    setThreshold,
    removeThreshold,
    dismissAlert,
    breachContractIds,
  ]);

  return (
    <RiskAlertContext.Provider value={value}>
      {children}
    </RiskAlertContext.Provider>
  );
}

// ─── Consumer hook ────────────────────────────────────────────────────────────

export function useRiskAlertContext(): RiskAlertContextValue {
  const ctx = useContext(RiskAlertContext);
  if (!ctx) {
    throw new Error(
      "useRiskAlertContext must be used within a RiskAlertProvider"
    );
  }
  return ctx;
}
