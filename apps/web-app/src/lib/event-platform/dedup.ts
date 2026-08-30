/**
 * Pure hysteresis / suppression / escalation decision logic for the outbox.
 *
 * This is the canonical spec for "exactly one delivered event per transition
 * into a state" — `supabase/migrations/0005_event_platform_functions.sql`'s
 * `fn_raise_platform_event` is a deliberate, faithful plpgsql translation of
 * `computeTransition` below, run atomically (row-locked) in Postgres. Keep
 * the two in sync: a rule change here without the matching SQL change means
 * the atomic path and the tested path diverge.
 */
import type { Severity } from "./types";

export type AlertStatus = "active" | "resolved";

export interface AlertDedupeState {
  status: AlertStatus;
  severity: Severity;
  /** Consecutive evaluations the condition has stayed active at its current severity. */
  cycleCount: number;
  /** Epoch ms until which a fresh breach is suppressed after a resolution; null if none. */
  suppressedUntil: number | null;
}

export const INITIAL_DEDUPE_STATE: AlertDedupeState = {
  status: "resolved",
  severity: "info",
  cycleCount: 0,
  suppressedUntil: null,
};

export interface TransitionInput {
  state: AlertDedupeState;
  /** Severity reported by this evaluation (ignored when `isResolution`). */
  severity: Severity;
  isResolution: boolean;
  now: number;
  suppressionWindowMs?: number;
  escalationCycleThreshold?: number;
}

export type TransitionDecision =
  | {
      emit: false;
      reason:
        | "suppressed"
        | "already-active"
        | "already-resolved"
        | "resolution-recorded";
      nextState: AlertDedupeState;
    }
  | {
      emit: true;
      /** May differ from the input severity when this is a cycle-count auto-escalation. */
      severity: Severity;
      escalated: boolean;
      nextState: AlertDedupeState;
    };

const RANK: Record<Severity, number> = { info: 1, warning: 2, critical: 3 };
const NEXT_LEVEL: Record<Severity, Severity> = {
  info: "warning",
  warning: "critical",
  critical: "critical",
};

const DEFAULT_SUPPRESSION_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_ESCALATION_CYCLE_THRESHOLD = 3;

export function computeTransition({
  state,
  severity,
  isResolution,
  now,
  suppressionWindowMs = DEFAULT_SUPPRESSION_WINDOW_MS,
  escalationCycleThreshold = DEFAULT_ESCALATION_CYCLE_THRESHOLD,
}: TransitionInput): TransitionDecision {
  if (isResolution) {
    if (state.status === "active") {
      return {
        emit: false,
        reason: "resolution-recorded",
        nextState: {
          status: "resolved",
          severity: state.severity,
          cycleCount: 0,
          suppressedUntil: now + suppressionWindowMs,
        },
      };
    }
    return { emit: false, reason: "already-resolved", nextState: state };
  }

  if (state.status === "resolved") {
    if (state.suppressedUntil !== null && now < state.suppressedUntil) {
      return { emit: false, reason: "suppressed", nextState: state };
    }
    return {
      emit: true,
      severity,
      escalated: false,
      nextState: {
        status: "active",
        severity,
        cycleCount: 1,
        suppressedUntil: null,
      },
    };
  }

  // state.status === "active"
  if (RANK[severity] > RANK[state.severity]) {
    return {
      emit: true,
      severity,
      escalated: true,
      nextState: {
        status: "active",
        severity,
        cycleCount: state.cycleCount + 1,
        suppressedUntil: null,
      },
    };
  }

  const nextCycleCount = state.cycleCount + 1;
  if (
    nextCycleCount >= escalationCycleThreshold &&
    RANK[state.severity] < RANK.critical
  ) {
    const escalatedSeverity = NEXT_LEVEL[state.severity];
    return {
      emit: true,
      severity: escalatedSeverity,
      escalated: true,
      nextState: {
        status: "active",
        severity: escalatedSeverity,
        cycleCount: nextCycleCount,
        suppressedUntil: null,
      },
    };
  }

  return {
    emit: false,
    reason: "already-active",
    nextState: { ...state, cycleCount: nextCycleCount },
  };
}
