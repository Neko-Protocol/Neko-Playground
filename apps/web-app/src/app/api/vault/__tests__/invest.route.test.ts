import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/env.client", () => ({
  clientEnv: {
    stellarNetwork: "TESTNET",
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "http://rpc.local",
    horizonUrl: "http://horizon.local",
  },
}));

const {
  runOrResumeMock,
  ledgerStatusMock,
  getVaultManagerEnvMock,
  buildVaultClientMock,
} = vi.hoisted(() => ({
  runOrResumeMock: vi.fn(),
  ledgerStatusMock: vi.fn(),
  getVaultManagerEnvMock: vi.fn(() => ({
    secretKey: "S",
    rpcUrl: "http://rpc",
    networkPassphrase: "Test",
  })),
  buildVaultClientMock: vi.fn(() => ({
    client: {
      fetch_total_managed_funds: vi.fn(async () => ({
        result: [
          { idle_amount: 0n, total_amount: 0n, strategy_allocations: [] },
        ],
      })),
    },
  })),
}));

vi.mock("@/lib/vault/investLedger", () => ({
  runOrResumeVaultInvest: runOrResumeMock,
  getVaultInvestLedgerStatus: ledgerStatusMock,
}));

vi.mock("@/lib/vault/investSteps", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/vault/investSteps")>();
  return {
    ...actual,
    getVaultManagerEnv: getVaultManagerEnvMock,
    buildVaultClient: buildVaultClientMock,
  };
});

import { POST } from "../invest/route";
import { LeaseNotAcquiredError } from "@/lib/jobs/errors";

beforeEach(() => vi.clearAllMocks());

function postRequest(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/vault/invest", {
    method: "POST",
    headers,
  });
}

describe("POST /api/vault/invest", () => {
  it("returns 429 when the cooldown hasn't elapsed for a manual call", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: false,
      cooldownRemaining: 42,
    });
    const res = await POST(postRequest());
    expect(res.status).toBe(429);
    expect(runOrResumeMock).not.toHaveBeenCalled();
  });

  it("bypasses the cooldown for a cron-triggered call", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: false,
      cooldownRemaining: 42,
    });
    runOrResumeMock.mockResolvedValue({
      job: { status: "completed" },
      steps: [
        { kind: "harvest-aquarius", result: { hash: "h1", status: "SUCCESS" } },
        {
          kind: "invest-idle",
          result: { invested: false, results: [], idleAmount: 0 },
        },
        { kind: "collect-fees", result: { results: [], feesCollected: true } },
      ],
    });

    const res = await POST(postRequest({ "x-vercel-cron": "1" }));
    expect(res.status).toBe(200);
    expect(runOrResumeMock).toHaveBeenCalledTimes(1);
  });

  it("returns 409 when an overlapping invocation already holds the lease", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: true,
      cooldownRemaining: 0,
    });
    runOrResumeMock.mockRejectedValue(
      new LeaseNotAcquiredError("vault-invest", "singleton")
    );

    const res = await POST(postRequest());
    expect(res.status).toBe(409);
  });
});
