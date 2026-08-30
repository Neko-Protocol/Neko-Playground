/**
 * Pure cross-module correlation decision, mirroring the subquery in
 * `fn_raise_platform_event`: the most recent *other-source* event for the
 * same wallet within the correlation window is the correlation target — if
 * it already belongs to an incident, attach there; otherwise start a new
 * incident containing both events. Outside the window, or with no
 * other-source event at all, the new event stands alone.
 */
import type { EventSource } from "./types";

export interface CorrelationCandidateEvent {
  id: string;
  source: EventSource;
  createdAt: number;
  incidentId: string | null;
}

export interface CorrelationDecision {
  attachTo: "existing" | "new" | "none";
  incidentId: string | null;
  correlatedEventId: string | null;
}

export function decideCorrelation(
  newEvent: { source: EventSource; createdAt: number },
  recentEvents: CorrelationCandidateEvent[],
  windowMs: number
): CorrelationDecision {
  const match = recentEvents
    .filter(
      (e) =>
        e.source !== newEvent.source &&
        newEvent.createdAt - e.createdAt >= 0 &&
        newEvent.createdAt - e.createdAt <= windowMs
    )
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!match) {
    return { attachTo: "none", incidentId: null, correlatedEventId: null };
  }

  if (match.incidentId) {
    return {
      attachTo: "existing",
      incidentId: match.incidentId,
      correlatedEventId: match.id,
    };
  }

  return { attachTo: "new", incidentId: null, correlatedEventId: match.id };
}
