import { describe, it, expect, vi, beforeEach } from "vitest";

const { harvestMock, investIdleMock, collectFeesMock } = vi.hoisted(() => ({
  harvestMock: vi.fn(),
  investIdleMock: vi.fn(),
  collectFeesMock: vi.fn(),
}));

vi.mock("../investSteps", () => ({
  getVaultManagerEnv: () => ({
    secretKey: "S".padEnd(56, "A"),
    rpcUrl: "http://rpc.local",
    networkPassphrase: "Test SDF Network ; September 2015",
  }),
  buildVaultClient: () => ({ keypair: {}, server: {}, client: {} }),
  harvestAquarius: harvestMock,
  investIdle: investIdleMock,
  collectFees: collectFeesMock,
  VAULT_INVEST_COOLDOWN_MS: 5 * 60 * 1000,
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
  runOrResumeVaultInvest,
  getVaultInvestLedgerStatus,
  VAULT_INVEST_JOB_TYPE,
  VAULT_INVEST_EXTERNAL_REF,
} from "../investLedger";
import { jobStore } from "@/lib/jobs/store";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runOrResumeVaultInvest", () => {
  it("runs harvest, invest and fees in order on a clean cycle", async () => {
    harvestMock.mockResolvedValue({ hash: "h1", status: "SUCCESS" });
    investIdleMock.mockResolvedValue({
      invested: true,
      results: [{ strategy: "Neko", hash: "h2", status: "SUCCESS" }],
      idleAmount: 1,
    });
    collectFeesMock.mockResolvedValue({ results: [], feesCollected: true });

    const { job, steps } = await runOrResumeVaultInvest();

    expect(job.status).toBe("completed");
    expect(steps.map((s) => s.status)).toEqual([
      "completed",
      "completed",
      "completed",
    ]);
    expect(harvestMock).toHaveBeenCalledTimes(1);
    expect(investIdleMock).toHaveBeenCalledTimes(1);
    expect(collectFeesMock).toHaveBeenCalledTimes(1);
  });

  it("resumes at invest-idle after a crash and never re-harvests", async () => {
    // Seed the run and simulate a crash right after harvest completed: the
    // invest-idle step was claimed ("running") and the lease was never
    // released, exactly like a process dying mid-step.
    const job = await jobStore.startOrResumeJob({
      jobType: VAULT_INVEST_JOB_TYPE,
      externalRef: VAULT_INVEST_EXTERNAL_REF,
      steps: [
        { kind: "harvest-aquarius" },
        { kind: "invest-idle" },
        { kind: "collect-fees" },
      ],
      resetIfTerminal: true,
    });
    await jobStore.acquireLease(job.id, "crashed-worker", -5_000);
    await jobStore.completeStep(job.id, 0, { hash: "h1", status: "SUCCESS" });
    await jobStore.claimStep(job.id, 1);
    await jobStore.setStatus(job.id, "running");

    investIdleMock.mockResolvedValue({
      invested: false,
      results: [],
      idleAmount: 0,
    });
    collectFeesMock.mockResolvedValue({ results: [], feesCollected: true });

    const { job: finalJob } = await runOrResumeVaultInvest();

    expect(harvestMock).not.toHaveBeenCalled();
    expect(investIdleMock).toHaveBeenCalledTimes(1);
    expect(finalJob.status).toBe("completed");
  });

  it("marks the run failed and does not run invest/fees when harvest fails", async () => {
    harvestMock.mockResolvedValue({ hash: "", status: "error: boom" });

    const { job } = await runOrResumeVaultInvest();

    expect(job.status).toBe("failed");
    expect(investIdleMock).not.toHaveBeenCalled();
    expect(collectFeesMock).not.toHaveBeenCalled();
  });
});

describe("getVaultInvestLedgerStatus", () => {
  it("allows investing immediately when no run has ever completed", async () => {
    const status = await getVaultInvestLedgerStatus();
    expect(status).toEqual({ canInvest: true, cooldownRemaining: 0 });
  });

  it("reports the remaining cooldown after a completed run", async () => {
    harvestMock.mockResolvedValue({ hash: "h1", status: "SUCCESS" });
    investIdleMock.mockResolvedValue({
      invested: false,
      results: [],
      idleAmount: 0,
    });
    collectFeesMock.mockResolvedValue({ results: [], feesCollected: true });
    await runOrResumeVaultInvest();

    const status = await getVaultInvestLedgerStatus();
    expect(status.canInvest).toBe(false);
    expect(status.cooldownRemaining).toBeGreaterThan(0);
  });
});
