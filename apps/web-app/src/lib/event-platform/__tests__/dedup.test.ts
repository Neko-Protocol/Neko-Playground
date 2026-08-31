import { describe, it, expect } from "vitest";
import {
  computeTransition,
  INITIAL_DEDUPE_STATE,
  type AlertDedupeState,
} from "../dedup";

const T0 = 1_000_000;

describe("computeTransition", () => {
  it("emits on the first breach from the initial (resolved) state", () => {
    const decision = computeTransition({
      state: INITIAL_DEDUPE_STATE,
      severity: "warning",
      isResolution: false,
      now: T0,
    });

    expect(decision.emit).toBe(true);
    if (decision.emit) {
      expect(decision.severity).toBe("warning");
      expect(decision.escalated).toBe(false);
      expect(decision.nextState).toEqual<AlertDedupeState>({
        status: "active",
        severity: "warning",
        cycleCount: 1,
        suppressedUntil: null,
      });
    }
  });

  it("does not re-emit for a repeat evaluation of an ongoing breach at the same severity", () => {
    const active: AlertDedupeState = {
      status: "active",
      severity: "warning",
      cycleCount: 1,
      suppressedUntil: null,
    };

    const decision = computeTransition({
      state: active,
      severity: "warning",
      isResolution: false,
      now: T0 + 1,
      escalationCycleThreshold: 10,
    });

    expect(decision.emit).toBe(false);
    if (!decision.emit) {
      expect(decision.reason).toBe("already-active");
      expect(decision.nextState.cycleCount).toBe(2);
    }
  });

  it("records a resolution without emitting, and starts the suppression window", () => {
    const active: AlertDedupeState = {
      status: "active",
      severity: "warning",
      cycleCount: 3,
      suppressedUntil: null,
    };

    const decision = computeTransition({
      state: active,
      severity: "info",
      isResolution: true,
      now: T0,
      suppressionWindowMs: 60_000,
    });

    expect(decision.emit).toBe(false);
    if (!decision.emit) {
      expect(decision.reason).toBe("resolution-recorded");
      expect(decision.nextState).toEqual<AlertDedupeState>({
        status: "resolved",
        severity: "warning",
        cycleCount: 0,
        suppressedUntil: T0 + 60_000,
      });
    }
  });

  it("suppresses a re-breach inside the post-resolution suppression window (rapid flap)", () => {
    const resolved: AlertDedupeState = {
      status: "resolved",
      severity: "warning",
      cycleCount: 0,
      suppressedUntil: T0 + 60_000,
    };

    const decision = computeTransition({
      state: resolved,
      severity: "warning",
      isResolution: false,
      now: T0 + 1_000, // still inside the window
    });

    expect(decision.emit).toBe(false);
    if (!decision.emit) expect(decision.reason).toBe("suppressed");
  });

  it("emits again once a re-breach occurs after the suppression window has passed", () => {
    const resolved: AlertDedupeState = {
      status: "resolved",
      severity: "warning",
      cycleCount: 0,
      suppressedUntil: T0 + 60_000,
    };

    const decision = computeTransition({
      state: resolved,
      severity: "warning",
      isResolution: false,
      now: T0 + 60_001, // just past the window
    });

    expect(decision.emit).toBe(true);
  });

  it("emits immediately when severity worsens while already active (escalation)", () => {
    const active: AlertDedupeState = {
      status: "active",
      severity: "warning",
      cycleCount: 2,
      suppressedUntil: null,
    };

    const decision = computeTransition({
      state: active,
      severity: "critical",
      isResolution: false,
      now: T0,
    });

    expect(decision.emit).toBe(true);
    if (decision.emit) {
      expect(decision.severity).toBe("critical");
      expect(decision.escalated).toBe(true);
      expect(decision.nextState.severity).toBe("critical");
    }
  });

  it("auto-escalates one level once a condition persists past the cycle threshold at the same severity", () => {
    let state: AlertDedupeState = INITIAL_DEDUPE_STATE;
    let now = T0;

    // Cycle 1: first breach, emits at "warning".
    let decision = computeTransition({
      state,
      severity: "warning",
      isResolution: false,
      now,
      escalationCycleThreshold: 3,
    });
    expect(decision.emit).toBe(true);
    state = decision.nextState;

    // Cycle 2: still warning, no escalation yet.
    now += 1000;
    decision = computeTransition({
      state,
      severity: "warning",
      isResolution: false,
      now,
      escalationCycleThreshold: 3,
    });
    expect(decision.emit).toBe(false);
    state = decision.nextState;
    expect(state.cycleCount).toBe(2);

    // Cycle 3: crosses the threshold — auto-escalates to critical even
    // though the caller keeps reporting "warning".
    now += 1000;
    decision = computeTransition({
      state,
      severity: "warning",
      isResolution: false,
      now,
      escalationCycleThreshold: 3,
    });
    expect(decision.emit).toBe(true);
    if (decision.emit) {
      expect(decision.severity).toBe("critical");
      expect(decision.escalated).toBe(true);
    }
  });

  it("never escalates past critical", () => {
    const active: AlertDedupeState = {
      status: "active",
      severity: "critical",
      cycleCount: 10,
      suppressedUntil: null,
    };

    const decision = computeTransition({
      state: active,
      severity: "critical",
      isResolution: false,
      now: T0,
      escalationCycleThreshold: 1,
    });

    expect(decision.emit).toBe(false);
    if (!decision.emit) expect(decision.reason).toBe("already-active");
  });

  it("a resolution call while already resolved is a no-op", () => {
    const decision = computeTransition({
      state: INITIAL_DEDUPE_STATE,
      severity: "info",
      isResolution: true,
      now: T0,
    });

    expect(decision.emit).toBe(false);
    if (!decision.emit) expect(decision.reason).toBe("already-resolved");
  });
});
