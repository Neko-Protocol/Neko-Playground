import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { confirmPlanMock, cancelPlanMock, listPlansMock } = vi.hoisted(() => ({
  confirmPlanMock: vi.fn(),
  cancelPlanMock: vi.fn(),
  listPlansMock: vi.fn(),
}));

vi.mock("@/lib/jobs/automation/ledger", () => ({
  confirmPlan: confirmPlanMock,
  cancelPlan: cancelPlanMock,
  listPlansForWallet: listPlansMock,
}));

import { GET, POST } from "../execute/route";
import { JobOwnershipError, JobNotFoundError } from "@/lib/jobs/errors";

const WALLET = "G".padEnd(56, "A");

beforeEach(() => vi.clearAllMocks());

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/automation/execute", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("GET /api/automation/execute", () => {
  it("rejects a request with no walletAddress", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/automation/execute?strategyId=s1")
    );
    expect(res.status).toBe(400);
  });

  it("returns the wallet's plans", async () => {
    listPlansMock.mockResolvedValue([{ id: "plan-1" }]);
    const res = await GET(
      new NextRequest(
        `http://localhost/api/automation/execute?strategyId=s1&walletAddress=${WALLET}`
      )
    );
    expect(res.status).toBe(200);
    expect(listPlansMock).toHaveBeenCalledWith("s1", WALLET);
  });
});

describe("POST /api/automation/execute", () => {
  it("confirms a plan and returns the updated plan", async () => {
    confirmPlanMock.mockResolvedValue({ id: "plan-1", status: "completed" });
    const res = await POST(
      postRequest({
        plan: { id: "plan-1" },
        walletAddress: WALLET,
        action: "confirm",
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("completed");
  });

  it("returns 403 when cancelling a plan owned by another wallet", async () => {
    cancelPlanMock.mockRejectedValue(new JobOwnershipError());
    const res = await POST(
      postRequest({ planId: "plan-1", walletAddress: WALLET, action: "cancel" })
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when cancelling a plan that doesn't exist", async () => {
    cancelPlanMock.mockRejectedValue(
      new JobNotFoundError("automation-rebalance:missing")
    );
    const res = await POST(
      postRequest({
        planId: "missing",
        walletAddress: WALLET,
        action: "cancel",
      })
    );
    expect(res.status).toBe(404);
  });

  it("rejects a confirm with no walletAddress", async () => {
    const res = await POST(
      postRequest({ plan: { id: "plan-1" }, action: "confirm" })
    );
    expect(res.status).toBe(400);
    expect(confirmPlanMock).not.toHaveBeenCalled();
  });
});
