import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { RebalancePlan } from "@/features/automation/types/automation";

const raiseEventMock = vi.fn();
vi.mock("@/lib/event-platform/outbox", () => ({
  raiseEvent: (...args: unknown[]) => raiseEventMock(...args),
}));

const { POST } = await import("../route");

function seedPlan(overrides: Partial<RebalancePlan> = {}): RebalancePlan {
  const plan: RebalancePlan = {
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
  return plan;
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/automation/execute — failure event wiring", () => {
  beforeEach(() => {
    raiseEventMock.mockReset();
  });

  it("does not raise an event on a normal confirm (no failure occurred)", async () => {
    seedPlan();
    const res = await post({
      planId: "plan-1",
      strategyId: "strategy-1",
      action: "confirm",
    });
    expect(res.status).toBe(200);
    expect(raiseEventMock).not.toHaveBeenCalled();
  });

  it("does not raise an event on cancel", async () => {
    seedPlan();
    await post({
      planId: "plan-1",
      strategyId: "strategy-1",
      action: "cancel",
    });
    expect(raiseEventMock).not.toHaveBeenCalled();
  });

  it("raises exactly one platform event, attributed to the plan and wallet, when a plan is already failed", async () => {
    // Simulates the future step-execution worker (see the route's own TODO)
    // having already marked this plan failed before confirm/cancel runs.
    seedPlan({ status: "failed" });

    await post({
      planId: "plan-1",
      strategyId: "strategy-1",
      action: "cancel",
      walletAddress: "GWALLET1",
    });

    expect(raiseEventMock).toHaveBeenCalledTimes(1);
    expect(raiseEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "automation",
        walletAddress: "GWALLET1",
        dedupeKey: "plan-failed:plan-1",
        eventType: "plan-failed",
        severity: "critical",
        payload: expect.objectContaining({
          planId: "plan-1",
          strategyId: "strategy-1",
        }),
      })
    );
  });

  it("skips raising when no walletAddress is supplied (plan has no owner concept today)", async () => {
    seedPlan({ status: "failed" });
    await post({
      planId: "plan-1",
      strategyId: "strategy-1",
      action: "cancel",
    });
    expect(raiseEventMock).not.toHaveBeenCalled();
  });
});
