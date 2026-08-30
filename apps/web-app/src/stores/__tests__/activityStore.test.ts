// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../stellarWalletStore", () => ({
  useStellarWalletStore: { getState: () => ({ address: "GWALLET1" }) },
}));

import { useActivityStore } from "../activityStore";

/**
 * Regression + integration coverage for the activity-feed bridge: the three
 * real call sites (useExecutionQueue, useLimitOrderMonitor, useVaultAction)
 * are untouched by this feature — they all just call `pushEvent(...)`, same
 * as before. This test exercises that exact call shape and asserts both
 * halves of the bridge: the existing local/optimistic list still works
 * unchanged, and the new durable POST fires with no call-site changes.
 */
describe("activityStore.pushEvent — durable bridge", () => {
  beforeEach(() => {
    useActivityStore.setState({ eventsByWallet: {} });
    vi.restoreAllMocks();
  });

  it("still records the event locally (existing/regression behavior)", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    useActivityStore.getState().pushEvent({
      source: "vault",
      type: "deposit",
      timestamp: Date.now(),
      summary: "Deposited 100 USDC",
      link: "/vaults",
    });

    const events = useActivityStore.getState().eventsByWallet["GWALLET1"];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("deposit");
    expect(events[0].read).toBe(false);
    expect(typeof events[0].id).toBe("string");
  });

  it("enqueues the same event durably via POST /api/events/ingest with no call-site changes", () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    useActivityStore.getState().pushEvent({
      source: "automation",
      type: "plan-confirmed",
      timestamp: Date.now(),
      summary: "Plan confirmed",
      link: "/automation",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/events/ingest");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");

    const body = JSON.parse(init.body as string);
    const localEvent =
      useActivityStore.getState().eventsByWallet["GWALLET1"][0];
    expect(body.id).toBe(localEvent.id); // same id reused as the dedupe key
    expect(body.source).toBe("automation");
    expect(body.type).toBe("plan-confirmed");
  });

  it("keeps the local activity feed intact when the durable POST fails (fallback/fast path)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    useActivityStore.getState().pushEvent({
      source: "swap",
      type: "limit-order-ready",
      timestamp: Date.now(),
      summary: "Limit order ready",
      link: "/swap",
    });

    // Let the rejected fetch's .catch() settle before asserting nothing throws.
    await Promise.resolve();
    await Promise.resolve();

    const events = useActivityStore.getState().eventsByWallet["GWALLET1"];
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("limit-order-ready");
  });

  it("does not record or enqueue an event when no wallet is connected", async () => {
    vi.doMock("../stellarWalletStore", () => ({
      useStellarWalletStore: { getState: () => ({ address: undefined }) },
    }));
    vi.resetModules();
    const { useActivityStore: freshStore } = await import("../activityStore");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    freshStore.getState().pushEvent({
      source: "vault",
      type: "deposit",
      timestamp: Date.now(),
      summary: "Deposited",
      link: "/vaults",
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(freshStore.getState().eventsByWallet).toEqual({});
  });
});
