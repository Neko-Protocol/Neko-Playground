import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env.client", () => ({
  clientEnv: {
    lendingAdminAddress: "GADMIN000000000000000000000000000000000000000000000",
  },
}));

const raiseEventMock = vi.fn();
const resolveEventMock = vi.fn();
vi.mock("../outbox", () => ({
  raiseEvent: (...args: unknown[]) => raiseEventMock(...args),
  resolveEvent: (...args: unknown[]) => resolveEventMock(...args),
}));

const { reportStageOutcome } = await import("../vaultStageOutcome");

/**
 * Covers the vault-invest producer's failure→event wiring in isolation from
 * the Soroban transaction pipeline itself (mocking a full RPC/contract-call
 * chain wouldn't meaningfully test anything beyond these boolean
 * conditions, and app/api/vault/invest/route.ts can't even be imported by
 * Vitest — see this module's own doc comment) — the outbox's
 * one-event-per-transition guarantee is covered separately in
 * outbox.integration.test.ts.
 */
describe("reportStageOutcome (vault/invest producer)", () => {
  beforeEach(() => {
    raiseEventMock.mockReset();
    resolveEventMock.mockReset();
  });

  it("raises exactly one critical vault event, attributed to the correct stage, on failure", async () => {
    await reportStageOutcome("harvestAquarius", true, { status: "FAILED" });

    expect(raiseEventMock).toHaveBeenCalledTimes(1);
    expect(resolveEventMock).not.toHaveBeenCalled();
    expect(raiseEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "vault",
        eventType: "harvestAquarius-failed",
        severity: "critical",
        dedupeKey: "vault-invest-stage:harvestAquarius",
        walletAddress: "GADMIN000000000000000000000000000000000000000000000",
      })
    );
  });

  it("resolves (does not raise) on success", async () => {
    await reportStageOutcome("collectFees", false, { feesCollected: true });

    expect(raiseEventMock).not.toHaveBeenCalled();
    expect(resolveEventMock).toHaveBeenCalledTimes(1);
    expect(resolveEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "vault",
        dedupeKey: "vault-invest-stage:collectFees",
      })
    );
  });

  it("attributes each stage's failure to its own dedupe key, never mixing stages", async () => {
    await reportStageOutcome("investIdle", true, {});
    expect(raiseEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ dedupeKey: "vault-invest-stage:investIdle" })
    );
  });
});
