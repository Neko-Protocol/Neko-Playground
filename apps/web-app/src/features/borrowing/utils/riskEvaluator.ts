/**
 * Risk evaluator — pure edge-detection logic for borrow-position alerting.
 *
 * No hooks, no I/O.  Given a position's live health factor and its previous
 * breach state, it decides whether a *new* alert should be raised.  The rules:
 *
 *  - A breach is `HF < effectiveThreshold`, where the effective threshold is
 *    the user's configured value (if any) but never below the hardcoded danger
 *    zone.  So a danger-zone breach always fires even without a user threshold.
 *  - An alert fires only on the transition from "not breached" to "breached"
 *    (edge, not level) — an ongoing breach never re-fires on subsequent ticks.
 *  - A breached position is only re-armed once HF recovers above
 *    `threshold + hysteresis`, so a value oscillating on the boundary does not
 *    spam alerts.
 *
 * This is the testable core of the feature — see `__tests__/riskEvaluator.test.ts`.
 */

import { HF_DANGER_ZONE, HF_ALERT_HYSTERESIS } from "../const/riskThresholds";
import type { RiskAlertKind } from "../types/riskAlert";

export interface EvaluateParams {
  /** Live on-chain health factor; `null` means no open position. */
  healthFactor: number | null;
  /** User-configured threshold for this position, or `null` if unset. */
  userThreshold: number | null;
  /** Whether the position was flagged as breached on the previous evaluation. */
  prevBreached: boolean;
  /** Danger-zone floor (defaults to the shared constant; injectable for tests). */
  dangerZone?: number;
  /** Recovery margin (defaults to the shared constant; injectable for tests). */
  hysteresis?: number;
}

export interface EvaluateResult {
  /** Effective threshold used for this evaluation. */
  effectiveThreshold: number;
  /** Whether the position is currently in breach. */
  breached: boolean;
  /** Whether a NEW alert should be raised on this evaluation. */
  shouldAlert: boolean;
  /** The breach flag to persist for the next evaluation. */
  nextBreached: boolean;
  /** Which boundary classified the breach (only meaningful when `breached`). */
  kind: RiskAlertKind;
}

/**
 * The threshold actually used to detect a breach: the user's value when set,
 * but never below the danger zone (which is a hard floor that always applies).
 */
export function getEffectiveThreshold(
  userThreshold: number | null,
  dangerZone: number = HF_DANGER_ZONE
): number {
  if (userThreshold === null) return dangerZone;
  return Math.max(userThreshold, dangerZone);
}

export function evaluatePosition({
  healthFactor,
  userThreshold,
  prevBreached,
  dangerZone = HF_DANGER_ZONE,
  hysteresis = HF_ALERT_HYSTERESIS,
}: EvaluateParams): EvaluateResult {
  const effectiveThreshold = getEffectiveThreshold(userThreshold, dangerZone);

  // No open position: nothing to alert, clear any breach state.
  if (healthFactor === null) {
    return {
      effectiveThreshold,
      breached: false,
      shouldAlert: false,
      nextBreached: false,
      kind: "threshold",
    };
  }

  const breached = healthFactor < effectiveThreshold;
  // Below the danger zone is always classified as danger-zone, regardless of
  // whether a user threshold is also set.
  const kind: RiskAlertKind =
    healthFactor < dangerZone ? "danger-zone" : "threshold";

  // Edge detection: alert only on the not-breached → breached transition.
  const shouldAlert = breached && !prevBreached;

  // Re-arm only once recovered above the hysteresis band; otherwise hold the
  // previous state so values hovering on the boundary don't re-trigger.
  let nextBreached = prevBreached;
  if (breached) {
    nextBreached = true;
  } else if (healthFactor >= effectiveThreshold + hysteresis) {
    nextBreached = false;
  }

  return { effectiveThreshold, breached, shouldAlert, nextBreached, kind };
}
