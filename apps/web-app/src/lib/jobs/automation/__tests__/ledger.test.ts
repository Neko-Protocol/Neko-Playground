import { describe, it, expect, vi, beforeEach } from "vitest";

const { withdrawMock, depositMock } = vi.hoisted(() => ({
  withdrawMock: vi.fn(async () => ({ xdr: "WITHDRAW_XDR" })),
  depositMock: vi.fn(async () => ({ xdr: "DEPOSIT_XDR" })),
}));

vi.mock("../stepExecutors", () => ({
  automationStepExecutors: {
    withdraw: withdrawMock,
    deposit: depositMock,
  },
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

import {
  confirmPlan,
  cancelPlan,
  listPlansForWallet,
  listHistoryForWallet,
} from "../ledger";
import { JobOwnershipError } from "@/lib/jobs/errors";
import type { RebalancePlan } from "@/features/automation/types/automation";

const WALLET_A = "G".padEnd(56, "A");
const WALLET_B = "G".padEnd(56, "B");

function makePlan(overrides: Partial<RebalancePlan> = {}): RebalancePlan {
  return {
    id: overrides.id ?? "plan-1",
    strategyId: "strategy-1",
    createdAt: Date.now(),
    triggerReason: "Net-APY threshold exceeded",
    currentBlendedNetApyBps: 500,
    proposedBlendedNetApyBps: 600,
    improvementBps: 100,
    estimatedSlippageBps: 10,
    estimatedFeeUsd: 1,
    estimatedGasUsd: 0.1,
    projectedEarningsDeltaUsd: { d30: 1, d90: 3, d365: 12 },
    targets: [{ venueId: "neko-lending", targetPct: 100, deltaUsd: 100 }],
    steps: [
      {
        id: "step-0",
        planId: overrides.id ?? "plan-1",
        index: 0,
        kind: "withdraw",
        venueId: "blend:pool:asset",
        asset: "USDC",
        amountUsd: 50,
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: "step-1",
        planId: overrides.id ?? "plan-1",
        index: 1,
        kind: "deposit",
        venueId: "neko:USDC",
        asset: "USDC",
        amountUsd: 50,
        status: "pending",
        retryCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    status: "draft",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("confirmPlan", () => {
  it("executes withdraw then deposit against the real executors and completes the plan", async () => {
    const plan = makePlan({ id: "plan-happy" });
    const result = await confirmPlan(plan, WALLET_A, "Balanced");

    expect(withdrawMock).toHaveBeenCalledTimes(1);
    expect(depositMock).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("completed");
    expect(result.steps.map((s) => s.status)).toEqual([
      "confirmed",
      "confirmed",
    ]);
  });

  it("marks the plan failed and skips later steps when a step throws", async () => {
    withdrawMock.mockRejectedValueOnce(new Error("adapter unavailable"));
    const plan = makePlan({ id: "plan-failing" });

    const result = await confirmPlan(plan, WALLET_A, "Balanced");

    expect(result.status).toBe("failed");
    expect(result.steps[0].status).toBe("failed");
    expect(result.steps[0].error).toBe("adapter unavailable");
    expect(result.steps[1].status).toBe("skipped");
    expect(depositMock).not.toHaveBeenCalled();
  });

  it("rejects confirming the same plan again for a different wallet", async () => {
    const plan = makePlan({ id: "plan-owned" });
    await confirmPlan(plan, WALLET_A, "Balanced");

    await expect(
      confirmPlan(plan, WALLET_B, "Balanced")
    ).rejects.toBeInstanceOf(JobOwnershipError);
  });
});

describe("cancelPlan", () => {
  it("marks a confirmed plan aborted and rejects a non-owning wallet", async () => {
    const plan = makePlan({ id: "plan-to-cancel" });
    withdrawMock.mockImplementationOnce(async () => {
      throw new Error("never resolves in this test");
    });
    // Confirm once (fails immediately at withdraw) so the run exists.
    await confirmPlan(plan, WALLET_A, "Balanced");

    await expect(cancelPlan("plan-to-cancel", WALLET_B)).rejects.toBeInstanceOf(
      JobOwnershipError
    );

    const cancelled = await cancelPlan("plan-to-cancel", WALLET_A);
    expect(cancelled.status).toBe("aborted"); // failed plans are still dismissable
  });
});

describe("listPlansForWallet / listHistoryForWallet", () => {
  const WALLET_C = "G".padEnd(56, "C");
  const WALLET_D = "G".padEnd(56, "D");

  it("only returns plans and history entries owned by the requesting wallet", async () => {
    await confirmPlan(makePlan({ id: "plan-scoped-a" }), WALLET_C, "Balanced");
    await confirmPlan(makePlan({ id: "plan-scoped-b" }), WALLET_D, "Balanced");

    const plansForC = await listPlansForWallet(null, WALLET_C);
    expect(plansForC.map((p) => p.id)).toEqual(["plan-scoped-a"]);

    const historyForC = await listHistoryForWallet(WALLET_C);
    expect(historyForC).toHaveLength(1);
    expect(historyForC[0].outcome).toBe("executed");
  });
});
