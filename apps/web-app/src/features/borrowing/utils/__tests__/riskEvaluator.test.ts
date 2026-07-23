/**
 * Unit tests for the borrow-position risk evaluator.
 *
 * These cover the acceptance criteria that are pure logic:
 *  - a crossing raises exactly one alert,
 *  - an ongoing breach does not raise duplicates on every tick,
 *  - a new alert is only raised after recovering above the threshold,
 *  - the hardcoded danger zone fires without a user threshold.
 */

import { describe, it, expect } from "vitest";
import { evaluatePosition, getEffectiveThreshold } from "../riskEvaluator";
import { HF_DANGER_ZONE } from "../../const/riskThresholds";

/**
 * Feed a sequence of health-factor values through the evaluator, threading the
 * persisted `breached` state forward exactly as the provider does.  Returns the
 * number of alerts that would have been raised.
 */
function runSequence(
  sequence: (number | null)[],
  userThreshold: number | null
): number {
  let prevBreached = false;
  let alerts = 0;
  for (const hf of sequence) {
    const r = evaluatePosition({
      healthFactor: hf,
      userThreshold,
      prevBreached,
    });
    if (r.shouldAlert) alerts += 1;
    prevBreached = r.nextBreached;
  }
  return alerts;
}

// ─── getEffectiveThreshold ───────────────────────────────────────────────────

describe("getEffectiveThreshold", () => {
  it("uses the danger zone when no user threshold is set", () => {
    expect(getEffectiveThreshold(null)).toBe(HF_DANGER_ZONE);
  });

  it("uses the user threshold when it is above the danger zone", () => {
    expect(getEffectiveThreshold(1.3)).toBe(1.3);
  });

  it("never drops below the danger zone", () => {
    expect(getEffectiveThreshold(1.05)).toBe(HF_DANGER_ZONE);
  });
});

// ─── Edge detection & de-duplication ─────────────────────────────────────────

describe("evaluatePosition — alerting", () => {
  it("raises exactly one alert on the first crossing", () => {
    expect(runSequence([1.5, 1.4, 1.25], 1.3)).toBe(1);
  });

  it("does not raise duplicate alerts while the breach is ongoing", () => {
    // Crosses once, then stays below for several ticks.
    expect(runSequence([1.5, 1.25, 1.2, 1.15, 1.05], 1.3)).toBe(1);
  });

  it("raises a new alert only after recovering above the threshold + hysteresis", () => {
    // down (alert) → still down → recover well above → down again (alert).
    expect(runSequence([1.5, 1.2, 1.1, 1.4, 1.2], 1.3)).toBe(2);
  });

  it("does not re-arm while inside the hysteresis band", () => {
    // Threshold 1.3, hysteresis 0.05 → must exceed 1.35 to re-arm.
    // Recovers only to 1.32 (inside band) then dips again → still one alert.
    expect(runSequence([1.5, 1.2, 1.32, 1.2], 1.3)).toBe(1);
  });

  it("fires the danger zone with no user threshold configured", () => {
    // No threshold → only fires below HF_DANGER_ZONE (1.1).
    expect(runSequence([1.4, 1.2, 1.05], null)).toBe(1);
  });

  it("does not fire above the danger zone when no threshold is set", () => {
    expect(runSequence([1.4, 1.2, 1.15], null)).toBe(0);
  });

  it("treats a closed position (null HF) as recovered", () => {
    // down (alert) → position closed → reopened below → new alert.
    expect(runSequence([1.5, 1.2, null, 1.2], 1.3)).toBe(2);
  });
});

// ─── Classification & fields ─────────────────────────────────────────────────

describe("evaluatePosition — classification", () => {
  it("classifies a breach below the danger zone as danger-zone", () => {
    const r = evaluatePosition({
      healthFactor: 1.05,
      userThreshold: 1.3,
      prevBreached: false,
    });
    expect(r.shouldAlert).toBe(true);
    expect(r.kind).toBe("danger-zone");
  });

  it("classifies a breach between threshold and danger zone as threshold", () => {
    const r = evaluatePosition({
      healthFactor: 1.2,
      userThreshold: 1.3,
      prevBreached: false,
    });
    expect(r.shouldAlert).toBe(true);
    expect(r.kind).toBe("threshold");
  });

  it("does not alert or breach when there is no open position", () => {
    const r = evaluatePosition({
      healthFactor: null,
      userThreshold: 1.3,
      prevBreached: true,
    });
    expect(r.breached).toBe(false);
    expect(r.shouldAlert).toBe(false);
    expect(r.nextBreached).toBe(false);
  });
});
