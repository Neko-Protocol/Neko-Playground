import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { RebalancePlan } from "@/features/automation/types/automation";
import {
  JobNotFoundError,
  JobOwnershipError,
  LeaseNotAcquiredError,
} from "@/lib/jobs/errors";

const { confirmPlanMock, cancelPlanMock, listPlansForWalletMock } = vi.hoisted(
  () => ({
    confirmPlanMock: vi.fn(),
    cancelPlanMock: vi.fn(),
    listPlansForWalletMock: vi.fn(),
  })
);

vi.mock("@/lib/jobs/automation/ledger", () => ({
  confirmPlan: confirmPlanMock,
  cancelPlan: cancelPlanMock,
  listPlansForWallet: listPlansForWalletMock,
}));

import { GET, POST } from "../route";

const TEST_WALLET = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

function makePlan(overrides: Partial<RebalancePlan> = {}): RebalancePlan {
  return {
    id: "plan-1",
    strategyId: "strategy-1",
    createdAt: Date.now(),
    triggerReason: "test",
    currentBlendedNetApyBps: 0,
    proposedBlendedNetApyBps: 0,
    improvementBps: 0,
    estimatedSlippageBps: 0,
    estimatedFeeUsd: 0,
    estimatedGasUsd: 0,
    projectedEarningsDeltaUsd: { d30: 0, d90: 0, d365: 0 },
    targets: [],
    steps: [],
    status: "draft",
    ...overrides,
  };
}

describe("GET /api/automation/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when walletAddress query param is missing", async () => {
    const req = new NextRequest("http://localhost/api/automation/execute");
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("walletAddress is required");
  });

  it("returns 200 with list of plans when walletAddress is provided", async () => {
    const plans = [makePlan()];
    listPlansForWalletMock.mockResolvedValue(plans);
    const req = new NextRequest(
      `http://localhost/api/automation/execute?walletAddress=${TEST_WALLET}&strategyId=strategy-1`
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual(plans);
    expect(listPlansForWalletMock).toHaveBeenCalledWith(
      "strategy-1",
      TEST_WALLET
    );
  });
});

describe("POST /api/automation/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when walletAddress is missing", async () => {
    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({ action: "confirm" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 on confirm if plan is missing", async () => {
    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm",
        walletAddress: TEST_WALLET,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("plan is required");
  });

  it("successfully confirms a plan", async () => {
    const plan = makePlan();
    const confirmedPlan = { ...plan, status: "confirmed" };
    confirmPlanMock.mockResolvedValue(confirmedPlan);

    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm",
        plan,
        walletAddress: TEST_WALLET,
        strategyName: "My Strategy",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("confirmed");
    expect(confirmPlanMock).toHaveBeenCalledWith(
      plan,
      TEST_WALLET,
      "My Strategy"
    );
  });

  it("returns 400 on cancel if planId is missing", async () => {
    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "cancel",
        walletAddress: TEST_WALLET,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("planId is required");
  });

  it("successfully cancels a plan", async () => {
    const plan = makePlan({ status: "aborted" });
    cancelPlanMock.mockResolvedValue(plan);

    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "cancel",
        planId: "plan-1",
        walletAddress: TEST_WALLET,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("aborted");
    expect(cancelPlanMock).toHaveBeenCalledWith("plan-1", TEST_WALLET);
  });

  it("returns 403 when JobOwnershipError is thrown", async () => {
    cancelPlanMock.mockRejectedValue(new JobOwnershipError());
    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "cancel",
        planId: "plan-1",
        walletAddress: TEST_WALLET,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 404 when JobNotFoundError is thrown", async () => {
    cancelPlanMock.mockRejectedValue(new JobNotFoundError("plan-1"));
    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "cancel",
        planId: "plan-1",
        walletAddress: TEST_WALLET,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 409 when LeaseNotAcquiredError is thrown", async () => {
    confirmPlanMock.mockRejectedValue(
      new LeaseNotAcquiredError("automation-rebalance", "plan-1")
    );
    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "confirm",
        plan: makePlan(),
        walletAddress: TEST_WALLET,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 on unknown action", async () => {
    const req = new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify({
        action: "unknown",
        walletAddress: TEST_WALLET,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
