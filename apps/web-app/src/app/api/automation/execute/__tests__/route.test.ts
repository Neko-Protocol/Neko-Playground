import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import type { RebalancePlan } from "@/features/automation/types/automation";

const { raiseEventMock, executeMock } = vi.hoisted(() => ({
  raiseEventMock: vi.fn(),
  executeMock: vi.fn(),
}));

vi.mock("@/lib/event-platform/outbox", () => ({
  raiseEvent: raiseEventMock,
}));

vi.mock("@/lib/jobs/automation/stepExecutors", () => ({
  automationStepExecutors: { withdraw: executeMock },
}));

vi.mock("@/lib/jobs/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jobs/store")>();
  const { InMemoryJobsBackend } =
    await import("@/lib/jobs/__tests__/inMemoryJobsBackend");
  return {
    ...actual,
    jobStore: new actual.JobStore(new InMemoryJobsBackend()),
  };
});

import { jobStore } from "@/lib/jobs/store";
import { POST } from "../route";

const WALLET_A = "G".padEnd(56, "A");
const WALLET_B = "G".padEnd(56, "B");

function makePlan(id: string): RebalancePlan {
  return {
    id,
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
    steps: [
      {
        id: id + "-step-0",
        planId: id,
        index: 0,
        kind: "withdraw",
        venueId: "neko:USDC",
        asset: "USDC",
        amountUsd: 1,
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    status: "draft",
  };
}

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("http://localhost/api/automation/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/automation/execute — durable failure event wiring", () => {
  beforeEach(() => {
    raiseEventMock.mockReset().mockResolvedValue({ created: true });
    executeMock.mockReset().mockResolvedValue({ xdr: "UNSIGNED_XDR" });
  });

  afterEach(() => vi.restoreAllMocks());

  it("accepts the client plan payload without raising an event on successful execution", async () => {
    const plan = makePlan("plan-normal");
    const res = await post({
      plan,
      walletAddress: WALLET_A,
      strategyName: "Balanced",
      action: "confirm",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: plan.id,
      status: "completed",
    });
    expect(
      await jobStore.findJobRun("automation-rebalance", plan.id)
    ).toMatchObject({
      walletAddress: WALLET_A,
      status: "completed",
    });
    expect(executeMock).toHaveBeenCalledOnce();
    expect(raiseEventMock).not.toHaveBeenCalled();
  });

  it("does not raise a failure event when an owner cancels a pending ledger plan", async () => {
    const plan = makePlan("plan-cancel");
    await jobStore.startOrResumeJob({
      jobType: "automation-rebalance",
      externalRef: plan.id,
      walletAddress: WALLET_A,
      payload: { ...plan, strategyName: "Balanced" },
      steps: [],
    });

    const res = await post({
      planId: plan.id,
      walletAddress: WALLET_A,
      action: "cancel",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: plan.id, status: "aborted" });
    expect(executeMock).not.toHaveBeenCalled();
    expect(raiseEventMock).not.toHaveBeenCalled();
  });

  it("raises one platform event attributed to the plan and owning wallet after durable execution fails", async () => {
    const plan = makePlan("plan-failed");
    executeMock.mockRejectedValueOnce(new Error("adapter unavailable"));

    const res = await post({
      plan,
      walletAddress: WALLET_A,
      action: "confirm",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: plan.id,
      status: "failed",
      steps: [{ status: "failed", error: "adapter unavailable" }],
    });
    expect(
      await jobStore.findJobRun("automation-rebalance", plan.id)
    ).toMatchObject({
      walletAddress: WALLET_A,
      status: "failed",
    });
    expect(raiseEventMock).toHaveBeenCalledOnce();
    expect(raiseEventMock).toHaveBeenCalledWith({
      source: "automation",
      walletAddress: WALLET_A,
      dedupeKey: "plan-failed:" + plan.id,
      eventType: "plan-failed",
      severity: "critical",
      payload: { planId: plan.id, strategyId: plan.strategyId },
    });
  });

  it("rejects a missing wallet before storing a plan, executing steps, or raising events", async () => {
    const plan = makePlan("plan-no-wallet");
    const res = await post({ plan, action: "confirm" });

    expect(res.status).toBe(400);
    expect(
      await jobStore.findJobRun("automation-rebalance", plan.id)
    ).toBeNull();
    expect(executeMock).not.toHaveBeenCalled();
    expect(raiseEventMock).not.toHaveBeenCalled();
  });

  it("reuses the failed plan's event identity before its owner dismisses it", async () => {
    const plan = makePlan("plan-dismiss-failed");
    executeMock.mockRejectedValueOnce(new Error("adapter unavailable"));
    await post({ plan, walletAddress: WALLET_A, action: "confirm" });
    raiseEventMock.mockClear();

    const res = await post({
      planId: plan.id,
      walletAddress: WALLET_A,
      action: "cancel",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: plan.id, status: "aborted" });
    expect(executeMock).toHaveBeenCalledOnce();
    expect(raiseEventMock).toHaveBeenCalledOnce();
    expect(raiseEventMock).toHaveBeenCalledWith({
      source: "automation",
      walletAddress: WALLET_A,
      dedupeKey: "plan-failed:" + plan.id,
      eventType: "plan-failed",
      severity: "critical",
      payload: { planId: plan.id, strategyId: plan.strategyId },
    });
  });

  it("cannot attribute another wallet's failed plan to a different caller", async () => {
    const plan = makePlan("plan-owned");
    executeMock.mockRejectedValueOnce(new Error("adapter unavailable"));
    await post({ plan, walletAddress: WALLET_A, action: "confirm" });
    raiseEventMock.mockClear();

    const res = await post({
      plan,
      walletAddress: WALLET_B,
      action: "confirm",
    });

    expect(res.status).toBe(403);
    expect(executeMock).toHaveBeenCalledOnce();
    expect(raiseEventMock).not.toHaveBeenCalled();
  });

  it("retries failed event delivery with the same key without executing a failed step again", async () => {
    const plan = makePlan("plan-event-retry");
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});
    executeMock.mockRejectedValueOnce(new Error("adapter unavailable"));
    raiseEventMock.mockRejectedValueOnce(new Error("outbox unavailable"));

    const first = await post({
      plan,
      walletAddress: WALLET_A,
      action: "confirm",
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ id: plan.id, status: "failed" });
    expect(
      await jobStore.findJobRun("automation-rebalance", plan.id)
    ).toMatchObject({
      status: "failed",
    });

    const retry = await post({
      plan,
      walletAddress: WALLET_A,
      action: "confirm",
    });
    expect(retry.status).toBe(200);
    expect(executeMock).toHaveBeenCalledOnce();
    expect(raiseEventMock).toHaveBeenCalledTimes(2);
    const deliveryErrors = logError.mock.calls.filter(
      ([line]) =>
        typeof line === "string" &&
        line.includes('"msg":"automation_failure_event_delivery_failed"')
    );
    expect(deliveryErrors).toHaveLength(1);
    expect(JSON.parse(String(deliveryErrors[0]?.[0]))).toMatchObject({
      level: "error",
      route: "jobs/automation/ledger",
      planId: plan.id,
      err: { message: "outbox unavailable" },
    });
    for (const [event] of raiseEventMock.mock.calls) {
      expect(event).toMatchObject({
        walletAddress: WALLET_A,
        dedupeKey: "plan-failed:" + plan.id,
      });
    }
  });
});
