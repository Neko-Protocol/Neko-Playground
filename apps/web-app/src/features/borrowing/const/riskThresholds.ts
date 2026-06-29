/**
 * Risk Thresholds — Centralised health-factor constants.
 *
 * Every UI component and utility that references health-factor tiers should
 * import from here instead of using inline magic numbers.
 */

// ─── Health-Factor tier boundaries ──────────────────────────────────────────
/** Position is considered safe above this value. */
export const HF_SAFE = 1.5;

/**
 * Submit-time warning threshold.  When projected HF is between
 * HF_WARNING and HF_LIQUIDATION the user sees a non-blocking warning.
 */
export const HF_WARNING = 1.2;

/**
 * At or below this value the position is liquidatable.
 * Submit is **blocked** when projected HF falls below this value.
 */
export const HF_LIQUIDATION = 1.0;

// ─── Risk-tier type ─────────────────────────────────────────────────────────
export type RiskTier = "safe" | "caution" | "at-risk" | "unknown";

// ─── Warning descriptor ─────────────────────────────────────────────────────
export interface PositionWarning {
  /** "block" prevents submission; "warn" is informational. */
  severity: "block" | "warn";
  message: string;
}

// ─── Display helpers (Tailwind classes) ─────────────────────────────────────
export function getHealthFactorColor(hf: number | null): string {
  if (hf === null) return "text-white/40";
  if (hf >= HF_SAFE) return "text-green-400";
  if (hf >= HF_LIQUIDATION) return "text-yellow-400";
  return "text-red-400";
}

export function getHealthFactorLabel(hf: number | null): string {
  if (hf === null) return "No Position";
  if (hf >= HF_SAFE) return "Safe";
  if (hf >= HF_LIQUIDATION) return "Caution";
  return "At Risk";
}

/** Badge background + border Tailwind classes. */
export function getHealthFactorBadgeClasses(hf: number | null): {
  bgBorder: string;
  dotColor: string;
} {
  if (hf === null) {
    return { bgBorder: "bg-white/5 border-white/10", dotColor: "bg-white/20" };
  }
  if (hf >= HF_SAFE) {
    return {
      bgBorder: "bg-green-500/10 border-green-500/20",
      dotColor: "bg-green-400",
    };
  }
  if (hf >= HF_LIQUIDATION) {
    return {
      bgBorder: "bg-yellow-500/10 border-yellow-500/20",
      dotColor: "bg-yellow-400",
    };
  }
  return {
    bgBorder: "bg-red-500/10 border-red-500/20",
    dotColor: "bg-red-400",
  };
}
