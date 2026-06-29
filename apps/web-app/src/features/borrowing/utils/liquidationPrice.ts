/**
 * Liquidation-price & projected-position math.
 *
 * All functions are **pure** — no hooks, no network calls.
 * They mirror the on-chain health-factor formula:
 *
 *   Health Factor = (Collateral Value × Collateral Factor%) / Debt Value
 *
 * The Neko lending contract stores HF as a u32 with 7-decimal precision
 * (10_000_000 = 1.0).  We work in plain floats here because the inputs
 * already arrive as floating-point numbers from the UI layer.
 *
 * ---------------------------------------------------------------------------
 * Liquidation Price (per unit of collateral):
 *
 *   Liq Price = Debt Value / (Collateral Amount × Collateral Factor%)
 *
 * This is the collateral NAV at which HF = 1.0.  Below this price the
 * position becomes eligible for liquidation.
 * ---------------------------------------------------------------------------
 */

import {
  HF_SAFE,
  HF_WARNING,
  HF_LIQUIDATION,
  type RiskTier,
  type PositionWarning,
} from "../const/riskThresholds";

// ─── Projected Health Factor ─────────────────────────────────────────────────

/**
 * Calculate projected health factor after a proposed action.
 *
 * @param collateralValue     Total collateral value *after* the action.
 * @param debtValue           Total debt value *after* the action.
 * @param collateralFactorPct Collateral factor as a percentage (e.g. 75 → 0.75).
 * @returns Projected health factor, or `null` when debt is zero (no risk).
 */
export function calculateProjectedHealthFactor(
  collateralValue: number,
  debtValue: number,
  collateralFactorPct: number
): number | null {
  if (!Number.isFinite(debtValue) || debtValue <= 0) return null;
  if (!Number.isFinite(collateralValue) || collateralValue <= 0) return 0;
  if (!Number.isFinite(collateralFactorPct) || collateralFactorPct <= 0)
    return 0;

  return (collateralValue * (collateralFactorPct / 100)) / debtValue;
}

// ─── Liquidation Price ───────────────────────────────────────────────────────

/**
 * Estimate the collateral price (NAV) at which HF drops to exactly 1.0.
 *
 * @param collateralAmount    Amount of collateral tokens (not value).
 * @param debtValue           Total outstanding debt value.
 * @param collateralFactorPct Collateral factor percentage (e.g. 75).
 * @returns Price per collateral unit at HF = 1.0, or `null` when
 *          there is no meaningful position (zero debt or collateral).
 */
export function calculateLiquidationPrice(
  collateralAmount: number,
  debtValue: number,
  collateralFactorPct: number
): number | null {
  if (!Number.isFinite(debtValue) || debtValue <= 0) return null;
  if (!Number.isFinite(collateralAmount) || collateralAmount <= 0) return null;
  if (!Number.isFinite(collateralFactorPct) || collateralFactorPct <= 0)
    return null;

  return debtValue / (collateralAmount * (collateralFactorPct / 100));
}

// ─── Risk Tier ───────────────────────────────────────────────────────────────

/**
 * Map a health factor value to a risk tier label.
 */
export function getRiskTier(healthFactor: number | null): RiskTier {
  if (healthFactor === null) return "unknown";
  if (healthFactor >= HF_SAFE) return "safe";
  if (healthFactor >= HF_LIQUIDATION) return "caution";
  return "at-risk";
}

// ─── Warnings ────────────────────────────────────────────────────────────────

/**
 * Generate user-facing warnings based on the projected health factor.
 *
 * - **block** when projected HF < 1.0 (position would be liquidatable).
 * - **warn**  when projected HF is between 1.0 and 1.2 (close to danger).
 * - **warn**  when the action causes a tier downgrade (e.g. Safe → Caution).
 */
export function getPositionWarnings(
  projectedHF: number | null,
  currentHF: number | null
): PositionWarning[] {
  const warnings: PositionWarning[] = [];

  if (projectedHF === null) return warnings;

  if (projectedHF < HF_LIQUIDATION) {
    warnings.push({
      severity: "block",
      message:
        "This action would drop your health factor below 1.0, making your position liquidatable. Reduce the amount or add more collateral.",
    });
  } else if (projectedHF < HF_WARNING) {
    warnings.push({
      severity: "warn",
      message: `Projected health factor (${projectedHF.toFixed(2)}) is close to the liquidation threshold. Proceed with caution.`,
    });
  }

  // Tier-transition warning
  if (currentHF !== null && projectedHF !== null) {
    const currentTier = getRiskTier(currentHF);
    const projectedTier = getRiskTier(projectedHF);
    if (
      currentTier === "safe" &&
      (projectedTier === "caution" || projectedTier === "at-risk")
    ) {
      warnings.push({
        severity: "warn",
        message: `This action moves your position from Safe to ${projectedTier === "caution" ? "Caution" : "At Risk"}.`,
      });
    } else if (currentTier === "caution" && projectedTier === "at-risk") {
      warnings.push({
        severity: "warn",
        message: "This action moves your position from Caution to At Risk.",
      });
    }
  }

  return warnings;
}
