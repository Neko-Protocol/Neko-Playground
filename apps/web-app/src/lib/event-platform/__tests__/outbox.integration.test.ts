import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { raiseEvent, resolveEvent } from "../outbox";
import { createFakeDb, type FakeDb } from "./testUtils/fakeSupabase";

describe("raiseEvent (outbox, via fn_raise_platform_event)", () => {
  let db: FakeDb;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000_000_000);
    db = createFakeDb();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const asClient = () => db as unknown as SupabaseClient;

  it("creates exactly one event on the first breach", async () => {
    // Delivery-row enqueueing (event_deliveries) lands with the
    // queue-draining/multi-channel-delivery follow-up PR — this covers the
    // outbox write itself, which this PR's fn_raise_platform_event handles
    // in full atomically in Postgres regardless.
    const result = await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
      },
      asClient()
    );

    expect(result.created).toBe(true);
    expect(db.tables.platform_events).toHaveLength(1);
  });

  it("does not create a second event for repeated evaluations of the same ongoing breach", async () => {
    await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
      },
      asClient()
    );

    const second = await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
      },
      asClient()
    );

    expect(second.created).toBe(false);
    expect(db.tables.platform_events).toHaveLength(1);
  });

  it("resolving then re-breaching within the suppression window does not deliver a second event", async () => {
    await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
        suppressionWindowMs: 60_000,
      },
      asClient()
    );

    await resolveEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "breach-resolved",
        suppressionWindowMs: 60_000,
      },
      asClient()
    );

    vi.advanceTimersByTime(5_000); // still inside the 60s suppression window

    const rebreach = await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
        suppressionWindowMs: 60_000,
      },
      asClient()
    );

    expect(rebreach.created).toBe(false);
    expect(db.tables.platform_events).toHaveLength(1); // only the original breach
  });

  it("delivers again once a re-breach occurs after the suppression window passes", async () => {
    await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
        suppressionWindowMs: 60_000,
      },
      asClient()
    );
    await resolveEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "breach-resolved",
        suppressionWindowMs: 60_000,
      },
      asClient()
    );

    vi.advanceTimersByTime(61_000);

    const rebreach = await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
        suppressionWindowMs: 60_000,
      },
      asClient()
    );

    expect(rebreach.created).toBe(true);
    expect(db.tables.platform_events).toHaveLength(2);
  });

  it("keeps one wallet's events out of another wallet's results", async () => {
    await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
      },
      asClient()
    );
    await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET2",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
      },
      asClient()
    );

    const wallet1Events = db.tables.platform_events.filter(
      (e) => e.wallet_address === "GWALLET1"
    );
    const wallet2Events = db.tables.platform_events.filter(
      (e) => e.wallet_address === "GWALLET2"
    );
    expect(wallet1Events).toHaveLength(1);
    expect(wallet2Events).toHaveLength(1);
    expect(wallet1Events[0].id).not.toBe(wallet2Events[0].id);
  });

  it("correlates an automation failure and a following borrowing breach for the same wallet into one incident", async () => {
    const first = await raiseEvent(
      {
        source: "automation",
        walletAddress: "GWALLET1",
        dedupeKey: "plan-failed:plan1",
        eventType: "plan-failed",
        severity: "critical",
        correlationWindowMs: 300_000,
      },
      asClient()
    );

    vi.advanceTimersByTime(30_000); // within the correlation window

    const second = await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
        correlationWindowMs: 300_000,
      },
      asClient()
    );

    expect(first.incidentId).toBeFalsy();
    expect(second.incidentId).toBeTruthy();
    expect(db.tables.incidents).toHaveLength(1);

    const firstEventRow = db.tables.platform_events.find(
      (e) => e.id === first.eventId
    );
    expect(firstEventRow?.incident_id).toBe(second.incidentId);
  });

  it("does not correlate two related events outside the correlation window", async () => {
    await raiseEvent(
      {
        source: "automation",
        walletAddress: "GWALLET1",
        dedupeKey: "plan-failed:plan1",
        eventType: "plan-failed",
        severity: "critical",
        correlationWindowMs: 60_000,
      },
      asClient()
    );

    vi.advanceTimersByTime(61_000);

    const second = await raiseEvent(
      {
        source: "borrowing",
        walletAddress: "GWALLET1",
        dedupeKey: "hf-breach:pool1",
        eventType: "threshold-breach",
        severity: "warning",
        correlationWindowMs: 60_000,
      },
      asClient()
    );

    expect(second.incidentId).toBeFalsy();
    expect(db.tables.incidents).toHaveLength(0);
  });
});
