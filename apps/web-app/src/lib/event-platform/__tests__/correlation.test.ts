import { describe, it, expect } from "vitest";
import {
  decideCorrelation,
  type CorrelationCandidateEvent,
} from "../correlation";

const WINDOW_MS = 5 * 60 * 1000;

describe("decideCorrelation", () => {
  it("stands alone with no other-source events nearby", () => {
    const decision = decideCorrelation(
      { source: "borrowing", createdAt: 100_000 },
      [],
      WINDOW_MS
    );
    expect(decision).toEqual({
      attachTo: "none",
      incidentId: null,
      correlatedEventId: null,
    });
  });

  it("starts a new incident with the most recent other-source event inside the window", () => {
    const candidates: CorrelationCandidateEvent[] = [
      { id: "e1", source: "automation", createdAt: 100_000, incidentId: null },
    ];

    const decision = decideCorrelation(
      { source: "borrowing", createdAt: 100_000 + 60_000 },
      candidates,
      WINDOW_MS
    );

    expect(decision).toEqual({
      attachTo: "new",
      incidentId: null,
      correlatedEventId: "e1",
    });
  });

  it("attaches to an existing incident when the correlated event already belongs to one", () => {
    const candidates: CorrelationCandidateEvent[] = [
      {
        id: "e1",
        source: "automation",
        createdAt: 100_000,
        incidentId: "incident-1",
      },
    ];

    const decision = decideCorrelation(
      { source: "borrowing", createdAt: 100_000 + 60_000 },
      candidates,
      WINDOW_MS
    );

    expect(decision).toEqual({
      attachTo: "existing",
      incidentId: "incident-1",
      correlatedEventId: "e1",
    });
  });

  it("ignores events from the same source", () => {
    const candidates: CorrelationCandidateEvent[] = [
      { id: "e1", source: "borrowing", createdAt: 100_000, incidentId: null },
    ];

    const decision = decideCorrelation(
      { source: "borrowing", createdAt: 100_050 },
      candidates,
      WINDOW_MS
    );

    expect(decision.attachTo).toBe("none");
  });

  it("does not correlate two events outside the window", () => {
    const candidates: CorrelationCandidateEvent[] = [
      { id: "e1", source: "automation", createdAt: 100_000, incidentId: null },
    ];

    const decision = decideCorrelation(
      { source: "borrowing", createdAt: 100_000 + WINDOW_MS + 1 },
      candidates,
      WINDOW_MS
    );

    expect(decision.attachTo).toBe("none");
  });

  it("picks the most recent other-source candidate when several qualify", () => {
    const candidates: CorrelationCandidateEvent[] = [
      {
        id: "older",
        source: "automation",
        createdAt: 90_000,
        incidentId: null,
      },
      { id: "newer", source: "vault", createdAt: 95_000, incidentId: null },
    ];

    const decision = decideCorrelation(
      { source: "borrowing", createdAt: 100_000 },
      candidates,
      WINDOW_MS
    );

    expect(decision.correlatedEventId).toBe("newer");
  });
});
