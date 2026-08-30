import { describe, it, expect, vi } from "vitest";
import { JobStore } from "../store";
import { runJob } from "../runner";
import { LeaseNotAcquiredError } from "../errors";
import { InMemoryJobsBackend } from "./inMemoryJobsBackend";
import type { StepExecutor } from "../types";

function makeStore() {
  return new JobStore(new InMemoryJobsBackend());
}

describe("runJob — sequential execution", () => {
  it("executes steps in order and marks the run completed", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "automation-rebalance",
      externalRef: "plan-1",
      steps: [{ kind: "withdraw" }, { kind: "deposit" }],
    });

    const order: string[] = [];
    const executors: Record<string, StepExecutor> = {
      withdraw: async () => {
        order.push("withdraw");
        return { ok: true };
      },
      deposit: async () => {
        order.push("deposit");
        return { ok: true };
      },
    };

    const { job: finalJob, steps } = await runJob(store, {
      jobId: job.id,
      workerId: "worker-a",
      executors,
    });

    expect(order).toEqual(["withdraw", "deposit"]);
    expect(finalJob.status).toBe("completed");
    expect(steps.every((s) => s.status === "completed")).toBe(true);
  });

  it("marks the run failed and skips remaining pending steps without re-running the failed one", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "automation-rebalance",
      externalRef: "plan-2",
      steps: [{ kind: "withdraw" }, { kind: "swap" }, { kind: "deposit" }],
    });

    const depositExecutor = vi.fn(async () => ({ ok: true }));
    const executors: Record<string, StepExecutor> = {
      withdraw: async () => ({ ok: true }),
      swap: async () => {
        throw new Error("quote expired");
      },
      deposit: depositExecutor,
    };

    const { job: finalJob, steps } = await runJob(store, {
      jobId: job.id,
      workerId: "worker-a",
      executors,
    });

    expect(finalJob.status).toBe("failed");
    expect(finalJob.error).toBe("quote expired");
    expect(steps[0].status).toBe("completed");
    expect(steps[1].status).toBe("failed");
    expect(steps[2].status).toBe("skipped");
    expect(depositExecutor).not.toHaveBeenCalled();
  });

  it("resumes a crashed run without re-executing the already-completed step", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }, { kind: "invest-idle" }],
      resetIfTerminal: true,
    });

    // Simulate a crash: the harvest step finished and invest-idle was
    // claimed (status "running"), but the process died before it completed
    // or the lease was released — the lease itself is left stale too.
    await store.acquireLease(job.id, "crashed-worker", -5_000); // already expired
    await store.completeStep(job.id, 0, { hash: "abc" });
    await store.claimStep(job.id, 1);
    await store.setStatus(job.id, "running");
    // No releaseLease call — a real crash never runs the `finally` block.

    const harvest = vi.fn(async () => ({ hash: "should-not-run-again" }));
    const investIdle = vi.fn(async () => ({ invested: true }));

    const { job: finalJob } = await runJob(store, {
      jobId: job.id,
      workerId: "worker-b",
      executors: { "harvest-aquarius": harvest, "invest-idle": investIdle },
    });

    expect(harvest).not.toHaveBeenCalled();
    expect(investIdle).toHaveBeenCalledTimes(1);
    expect(finalJob.status).toBe("completed");
  });
});

describe("runJob — concurrency", () => {
  it("grants the lease to only one of two overlapping invocations", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
    });

    let releaseFirst: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const executed: string[] = [];
    const slowExecutor: StepExecutor = async () => {
      executed.push("ran");
      await gate;
      return {};
    };

    const firstRun = runJob(store, {
      jobId: job.id,
      workerId: "worker-a",
      executors: { "harvest-aquarius": slowExecutor },
    });

    // Give the first call a tick to acquire the lease and claim the step
    // before the second one races in.
    await new Promise((r) => setTimeout(r, 0));

    await expect(
      runJob(store, {
        jobId: job.id,
        workerId: "worker-b",
        executors: { "harvest-aquarius": slowExecutor },
      })
    ).rejects.toBeInstanceOf(LeaseNotAcquiredError);

    releaseFirst();
    await firstRun;

    expect(executed).toEqual(["ran"]);
  });
});
