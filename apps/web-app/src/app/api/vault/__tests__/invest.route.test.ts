import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { readFileSync } from "node:fs";

vi.mock("@/lib/env.client", () => ({
  clientEnv: {
    stellarNetwork: "TESTNET",
    rpcUrl: "http://rpc.local",
    horizonUrl: "http://horizon.local",
    networkPassphrase: "Test SDF Network ; September 2015",
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

vi.mock("@/lib/vault/investSteps", () => ({
  MIN_IDLE_THRESHOLD: 10_000_000n,
  getVaultManagerEnv: getVaultManagerEnvMock,
  buildVaultClient: buildVaultClientMock,
}));

import { GET as GETStatus, POST } from "../invest/route";
import { GET as GETCron } from "../invest/cron/route";
import { LeaseNotAcquiredError } from "@/lib/jobs/errors";

const CRON_SECRET = "test-cron-secret";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", CRON_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function completedRun() {
  return {
    job: { status: "completed" },
    steps: [
      { kind: "harvest-aquarius", result: { hash: "h1", status: "SUCCESS" } },
      {
        kind: "invest-idle",
        result: { invested: false, results: [], idleAmount: 0 },
      },
      { kind: "collect-fees", result: { results: [], feesCollected: true } },
    ],
  };
}

describe.each([
  { method: "POST", path: "/api/vault/invest", invoke: POST },
  { method: "GET", path: "/api/vault/invest/cron", invoke: GETCron },
])("$method $path", ({ method, path, invoke }) => {
  function postRequest(headers: Record<string, string> = {}) {
    return new NextRequest("http://localhost" + path, { method, headers });
  }

  it("returns 401 when Authorization is missing", async () => {
    const res = await invoke(postRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(runOrResumeMock).not.toHaveBeenCalled();
    expect(ledgerStatusMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the Bearer token is wrong", async () => {
    const res = await invoke(
      postRequest({ Authorization: "Bearer wrong-secret" })
    );
    expect(res.status).toBe(401);
    expect(runOrResumeMock).not.toHaveBeenCalled();
  });

  it("returns 401 when CRON_SECRET is unset even with a Bearer header", async () => {
    vi.stubEnv("CRON_SECRET", "");
    delete process.env.CRON_SECRET;

    const res = await invoke(
      postRequest({ Authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(401);
    expect(runOrResumeMock).not.toHaveBeenCalled();
  });

  it("returns 401 for a spoofed x-vercel-cron header without Bearer auth", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: false,
      cooldownRemaining: 42,
    });
    runOrResumeMock.mockResolvedValue(completedRun());

    const res = await invoke(postRequest({ "x-vercel-cron": "1" }));
    expect(res.status).toBe(401);
    expect(runOrResumeMock).not.toHaveBeenCalled();
  });

  it("returns 401 when x-vercel-cron is set alongside an invalid Bearer", async () => {
    const res = await invoke(
      postRequest({
        "x-vercel-cron": "1",
        Authorization: "Bearer not-the-secret",
      })
    );
    expect(res.status).toBe(401);
    expect(runOrResumeMock).not.toHaveBeenCalled();
  });

  it("returns 429 when authenticated but the cooldown hasn't elapsed", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: false,
      cooldownRemaining: 42,
    });
    const res = await invoke(
      postRequest({ Authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(429);
    expect(runOrResumeMock).not.toHaveBeenCalled();
  });

  it("runs the invest flow with a valid Bearer CRON_SECRET", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: true,
      cooldownRemaining: 0,
    });
    runOrResumeMock.mockResolvedValue(completedRun());

    const res = await invoke(
      postRequest({ Authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(runOrResumeMock).toHaveBeenCalledTimes(1);
    // Response must not leak secret key material
    expect(JSON.stringify(body)).not.toContain(CRON_SECRET);
    expect(JSON.stringify(body)).not.toMatch(/S[A-Z0-9]{50,}/);
  });

  it("does not bypass cooldown when x-vercel-cron is present with valid Bearer", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: false,
      cooldownRemaining: 17,
    });

    const res = await invoke(
      postRequest({
        "x-vercel-cron": "1",
        Authorization: `Bearer ${CRON_SECRET}`,
      })
    );
    expect(res.status).toBe(429);
    expect(runOrResumeMock).not.toHaveBeenCalled();
  });

  it("returns 409 when an overlapping invocation already holds the lease", async () => {
    ledgerStatusMock.mockResolvedValue({
      canInvest: true,
      cooldownRemaining: 0,
    });
    runOrResumeMock.mockRejectedValue(
      new LeaseNotAcquiredError("vault-invest", "singleton")
    );

    const res = await invoke(
      postRequest({ Authorization: `Bearer ${CRON_SECRET}` })
    );
    expect(res.status).toBe(409);
  });
});

it("keeps the public status GET read-only", async () => {
  ledgerStatusMock.mockResolvedValue({
    canInvest: true,
    cooldownRemaining: 0,
  });
  const res = await GETStatus();
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ idle: 0, total: 0 });
  expect(buildVaultClientMock).toHaveBeenCalledTimes(1);
  expect(runOrResumeMock).not.toHaveBeenCalled();
});

it("runs an investment through the configured cron GET path", async () => {
  const config = JSON.parse(
    readFileSync(
      new URL("../../../../../../../vercel.json", import.meta.url),
      "utf8"
    )
  ) as { crons: { path: string; schedule: string }[] };
  expect(config.crons).toHaveLength(1);
  const cron = config.crons[0];
  expect(cron.schedule).toBe("0 2 * * *");

  const handlers: Record<string, typeof POST> = {
    "/api/vault/invest": GETStatus,
    "/api/vault/invest/cron": GETCron,
  };
  const handler = handlers[cron.path];
  expect(handler).toBeDefined();
  ledgerStatusMock.mockResolvedValue({
    canInvest: true,
    cooldownRemaining: 0,
  });
  runOrResumeMock.mockResolvedValue(completedRun());
  const res = await handler(
    new NextRequest("http://localhost" + cron.path, {
      method: "GET",
      headers: { Authorization: "Bearer " + CRON_SECRET },
    })
  );
  expect(res.status).toBe(200);
  expect(runOrResumeMock).toHaveBeenCalledTimes(1);
  expect(await res.json()).toMatchObject({ success: true });
  expect(buildVaultClientMock).not.toHaveBeenCalled();
});

