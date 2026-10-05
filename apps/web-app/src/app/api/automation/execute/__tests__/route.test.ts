import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { confirmPlanMock, cancelPlanMock } = vi.hoisted(() => ({
  confirmPlanMock: vi.fn(),
  cancelPlanMock: vi.fn(),
}));

vi.mock("@/lib/jobs/automation/ledger", () => ({
  confirmPlan: confirmPlanMock,
  cancelPlan: cancelPlanMock,
  listPlansForWallet: vi.fn(),
}));

import { POST } from "../route";
import { LeaseNotAcquiredError } from "@/lib/jobs/errors";

const WALLET = "G".padEnd(56, "A");

beforeEach(() => vi.clearAllMocks());

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/automation/execute — request validation and conflicts", () => {
  it("requires a plan when confirming", async () => {
    const res = await post({ action: "confirm", walletAddress: WALLET });

    expect(res.status).toBe(400);
    expect(confirmPlanMock).not.toHaveBeenCalled();
  });

  it("requires a planId when cancelling", async () => {
    const res = await post({ action: "cancel", walletAddress: WALLET });

    expect(res.status).toBe(400);
    expect(cancelPlanMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown action without dispatching to the ledger", async () => {
    const res = await post({ action: "retry", walletAddress: WALLET });

    expect(res.status).toBe(400);
    expect(confirmPlanMock).not.toHaveBeenCalled();
    expect(cancelPlanMock).not.toHaveBeenCalled();
  });

  it("maps a ledger lease conflict to HTTP 409", async () => {
    cancelPlanMock.mockRejectedValue(
      new LeaseNotAcquiredError("automation-rebalance", "plan-1")
    );

    const res = await post({
      action: "cancel",
      planId: "plan-1",
      walletAddress: WALLET,
    });

    expect(res.status).toBe(409);
    expect(cancelPlanMock).toHaveBeenCalledWith("plan-1", WALLET);
  });
});
