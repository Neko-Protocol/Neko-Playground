import { describe, it, expect } from "vitest";
import { JobStore } from "../store";
import { LeaseNotAcquiredError } from "../errors";
import { InMemoryJobsBackend } from "./inMemoryJobsBackend";

function makeStore() {
  return new JobStore(new InMemoryJobsBackend());
}

describe("JobStore — lease acquisition and expiry", () => {
  it("grants the lease to the first caller and rejects a second while it's held", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
    });

    await store.acquireLease(job.id, "worker-a", 60_000);

    await expect(
      store.acquireLease(job.id, "worker-b", 60_000)
    ).rejects.toBeInstanceOf(LeaseNotAcquiredError);
  });

  it("allows a new owner to acquire the lease once it expires", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
    });

    await store.acquireLease(job.id, "worker-a", -5_000); // already expired
    const acquired = await store.acquireLease(job.id, "worker-b", 60_000);
    expect(acquired.leaseOwner).toBe("worker-b");
  });

  it("releases the lease so the same worker can re-acquire it", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
    });

    await store.acquireLease(job.id, "worker-a", 60_000);
    await store.releaseLease(job.id, "worker-a");
    const reacquired = await store.acquireLease(job.id, "worker-a", 60_000);
    expect(reacquired.leaseOwner).toBe("worker-a");
  });

  it("never grants a lease on a completed or cancelled run", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
    });
    await store.setStatus(job.id, "completed");

    await expect(
      store.acquireLease(job.id, "worker-a", 60_000)
    ).rejects.toBeInstanceOf(LeaseNotAcquiredError);
  });
});

describe("JobStore — idempotent step handling", () => {
  it("does not let a second claim of an already-completed step re-run it", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "automation-rebalance",
      externalRef: "plan-1",
      steps: [{ kind: "withdraw" }, { kind: "deposit" }],
    });

    const first = await store.claimStep(job.id, 0);
    expect(first.claimed).toBe(true);
    await store.completeStep(job.id, 0, { ok: true });

    const second = await store.claimStep(job.id, 0);
    expect(second.claimed).toBe(false);
    expect(second.step.status).toBe("completed");
    expect(second.step.result).toEqual({ ok: true });
  });

  it("startOrResumeJob returns the same run for a repeated external ref instead of duplicating it", async () => {
    const store = makeStore();
    const first = await store.startOrResumeJob({
      jobType: "automation-rebalance",
      externalRef: "plan-1",
      steps: [{ kind: "withdraw" }],
    });
    const second = await store.startOrResumeJob({
      jobType: "automation-rebalance",
      externalRef: "plan-1",
      steps: [{ kind: "withdraw" }],
    });
    expect(second.id).toBe(first.id);
  });

  it("resetIfTerminal resets a completed run's steps for a new cycle", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
    });
    await store.completeStep(job.id, 0, {});
    await store.setStatus(job.id, "completed");

    const resumed = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
      resetIfTerminal: true,
    });

    expect(resumed.id).toBe(job.id);
    expect(resumed.status).toBe("pending");
    const steps = await store.listSteps(job.id);
    expect(steps[0].status).toBe("pending");
  });

  it("resetIfTerminal also resets a failed run, so a transient failure doesn't stall the cycle forever", async () => {
    const store = makeStore();
    const job = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
    });
    await store.failStep(job.id, 0, { error: "rpc timeout" });
    await store.setStatus(job.id, "failed", "rpc timeout");

    const resumed = await store.startOrResumeJob({
      jobType: "vault-invest",
      externalRef: "singleton",
      steps: [{ kind: "harvest-aquarius" }],
      resetIfTerminal: true,
    });

    expect(resumed.id).toBe(job.id);
    expect(resumed.status).toBe("pending");
    expect(resumed.error).toBeNull();
    const steps = await store.listSteps(job.id);
    expect(steps[0].status).toBe("pending");
  });
});

describe("JobStore — action log ordering", () => {
  it("returns entries in the order they were appended", async () => {
    const store = makeStore();
    await store.appendActionLog({
      jobType: "vault-invest",
      message: "first",
    });
    await store.appendActionLog({
      jobType: "vault-invest",
      message: "second",
    });
    await store.appendActionLog({
      jobType: "vault-invest",
      message: "third",
    });

    const entries = await store.listActionLog("vault-invest");
    expect(entries.map((e) => e.message)).toEqual(["first", "second", "third"]);
  });

  it("scopes the log to the requested wallet", async () => {
    const store = makeStore();
    await store.appendActionLog({
      jobType: "automation-rebalance",
      walletAddress: "GWALLETA",
      message: "a's entry",
    });
    await store.appendActionLog({
      jobType: "automation-rebalance",
      walletAddress: "GWALLETB",
      message: "b's entry",
    });

    const entries = await store.listActionLog(
      "automation-rebalance",
      "GWALLETA"
    );
    expect(entries.map((e) => e.message)).toEqual(["a's entry"]);
  });
});
