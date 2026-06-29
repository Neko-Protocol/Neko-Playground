"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  calculateProjectedHealthFactor,
  calculateLiquidationPrice,
  getRiskTier,
  getPositionWarnings,
} from "../utils/liquidationPrice";
import {
  HF_LIQUIDATION,
  HF_WARNING,
  type RiskTier,
  type PositionWarning,
} from "../const/riskThresholds";

const DEBOUNCE_MS = 300;

// ─── Action types ────────────────────────────────────────────────────────────

export type SimulationAction =
  | { type: "borrow"; collateralAmount: number; borrowAmount: number }
  | { type: "repay"; repayAmount: number }
  | { type: "remove-collateral"; removeAmount: number };

// ─── Params & Result ─────────────────────────────────────────────────────────

export interface UsePositionSimulationParams {
  collateralFactorPct: number;
  action: SimulationAction;
  /** Existing collateral (for repay / remove-collateral flows). */
  currentCollateral?: number;
  /** Existing debt (for repay / remove-collateral flows). */
  currentDebt?: number;
  /** Live on-chain health factor for comparison display. */
  currentHealthFactor?: number | null;
  /** Set false to disable (e.g. wallet disconnected). */
  enabled?: boolean;
}

export interface PositionSimulationResult {
  projectedHealthFactor: number | null;
  liquidationPrice: number | null;
  riskTier: RiskTier;
  warnings: PositionWarning[];
  isSimulating: boolean;
  isStale: boolean;
  /** False when projected HF < 1.0 (submit should be blocked). */
  canSubmit: boolean;
  /** True when projected HF is between 1.0 and 1.2. */
  hasWarning: boolean;
}

const EMPTY_RESULT: PositionSimulationResult = {
  projectedHealthFactor: null,
  liquidationPrice: null,
  riskTier: "unknown",
  warnings: [],
  isSimulating: false,
  isStale: false,
  canSubmit: true,
  hasWarning: false,
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function usePositionSimulation({
  collateralFactorPct,
  action,
  currentCollateral = 0,
  currentDebt = 0,
  currentHealthFactor = null,
  enabled = true,
}: UsePositionSimulationParams): PositionSimulationResult {
  const [result, setResult] = useState<PositionSimulationResult>(EMPTY_RESULT);
  const [isStale, setIsStale] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Derive projected collateral & debt based on the action type.
  const { projectedCollateral, projectedDebt } = useMemo(() => {
    switch (action.type) {
      case "borrow":
        return {
          projectedCollateral: action.collateralAmount,
          projectedDebt: action.borrowAmount,
        };
      case "repay":
        return {
          projectedCollateral: currentCollateral,
          projectedDebt: Math.max(0, currentDebt - action.repayAmount),
        };
      case "remove-collateral":
        return {
          projectedCollateral: Math.max(
            0,
            currentCollateral - action.removeAmount
          ),
          projectedDebt: currentDebt,
        };
    }
  }, [action, currentCollateral, currentDebt]);

  // Check whether the inputs represent a meaningful position to simulate.
  const hasInput = useMemo(() => {
    switch (action.type) {
      case "borrow":
        return action.collateralAmount > 0 || action.borrowAmount > 0;
      case "repay":
        return action.repayAmount > 0;
      case "remove-collateral":
        return action.removeAmount > 0;
    }
  }, [action]);

  useEffect(() => {
    // Guard: nothing to simulate.
    if (!enabled || !hasInput) {
      setResult(EMPTY_RESULT);
      setIsStale(false);
      return;
    }

    // Mark stale immediately so the UI can dim previous results.
    setIsStale(true);

    // Clear any pending timer.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    timerRef.current = setTimeout(() => {
      const projectedHF = calculateProjectedHealthFactor(
        projectedCollateral,
        projectedDebt,
        collateralFactorPct
      );

      const liqPrice = calculateLiquidationPrice(
        projectedCollateral,
        projectedDebt,
        collateralFactorPct
      );

      const tier = getRiskTier(projectedHF);
      const warns = getPositionWarnings(projectedHF, currentHealthFactor);

      const canSubmit = projectedHF === null || projectedHF >= HF_LIQUIDATION;
      const hasWarning =
        projectedHF !== null &&
        projectedHF >= HF_LIQUIDATION &&
        projectedHF < HF_WARNING;

      setResult({
        projectedHealthFactor: projectedHF,
        liquidationPrice: liqPrice,
        riskTier: tier,
        warnings: warns,
        isSimulating: false,
        isStale: false,
        canSubmit,
        hasWarning,
      });
      setIsStale(false);
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [
    enabled,
    hasInput,
    projectedCollateral,
    projectedDebt,
    collateralFactorPct,
    currentHealthFactor,
  ]);

  // Merge the stale flag (which updates immediately) with the debounced result.
  return useMemo(
    () => ({ ...result, isStale: isStale || result.isStale }),
    [result, isStale]
  );
}
