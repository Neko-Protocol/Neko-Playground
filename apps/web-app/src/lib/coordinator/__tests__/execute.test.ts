import { describe, expect, it, vi } from "vitest";
import { InMemoryCoordinatorLedgerStore } from "../ledger";
import {
  reconcileCoordinatorRun,
  runCoordinatorUnwind,
  type CoordinatorExecutionDeps,
} from "../execute";
import { DelegationScopeViolationError } from "../types";
import type { TrancheSelection } from "../delegation";
import type {
  CoordinatorRun,
  DelegationGrant,
  DelegationTrancheRecord,
} from "../types";

function makeSignedTranche(
  id: string,
  order: number,
  debtAmount: string,
  stepCount = 2
): DelegationTrancheRecord {
  return {
    id,
    order,
    collateralAmount: "100",
    debtAmount,
    collateralPoolId: "blend:CPOOL:CUSTRY",
    borrowPoolId: "blend:CPOOL:CUSDC",
    steps: Array.from({ length: stepCount }, (_, i) => ({
      stepId: `${id}-step-${i}`,
      operationType:
        i === 0 ? ("repay" as const) : ("withdrawCollateral" as const),
      protocol: "blend",
      poolType: "blend" as const,
      assetCode: i === 0 ? "USDC" : "USTRY",
      amount: debtAmount,
      submissionMode: "rpc" as const,
      signedXdr: `xdr-${id}-${i}`,
      networkPassphrase: "net",
    })),
  };
}

function makeGrant(tranches: DelegationTrancheRecord[]): DelegationGrant {
  return {
    id: "grant-1",
    positionId: "position-1",
    walletAddress: "GUSER",
    assetCode: "USTRY",
    borrowAssetCode: "USDC",
    status: "active",
    createdAt: 0,
    expiresAt: Date.now() + 1_000_000,
    tranches,
    consumedTrancheIds: [],
    guardConfig: { deleverageThreshold: 1.15, hysteresis: 0.05 },
    breached: false,
  };
}

function selectionFor(...trancheIds: string[]): TrancheSelection {
  return { trancheIds, steps: [] };
}

function makeDeps(overrides: Partial<CoordinatorExecutionDeps> = {}): {
  deps: CoordinatorExecutionDeps;
  submit: ReturnType<typeof vi.fn>;
  confirm: ReturnType<typeof vi.fn>;
} {
  const submit = vi.fn(async (xdr: string) => ({ hash: `hash-${xdr}` }));
  const confirm = vi.fn(async () => ({ status: "SUCCESS" }));
  const store = new InMemoryCoordinatorLedgerStore();
  const deps: CoordinatorExecutionDeps = {
    store,
    transports: { rpc: { submit, confirm }, soroswapApi: { submit, confirm } },
    ...overrides,
  };
  return { deps, submit, confirm };
}

describe("runCoordinatorUnwind", () => {
  it("submits and confirms every step of every selected tranche, then marks tranches consumed", async () => {
    const tranche = makeSignedTranche("t0", 0, "50");
    const grant = makeGrant([tranche]);
    const { deps, submit, confirm } = makeDeps();

    const run = await runCoordinatorUnwind(deps, {
      grant,
      selection: selectionFor("t0"),
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
    });

    expect(run.status).toBe("completed");
    expect(run.steps).toHaveLength(2);
    expect(run.steps.every((s) => s.status === "completed")).toBe(true);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(confirm).toHaveBeenCalledTimes(2);

    const savedGrant = await deps.store.getGrant(grant.positionId);
    expect(savedGrant?.consumedTrancheIds).toEqual(["t0"]);
  });

  it("resumes an in-progress run without re-submitting already-completed steps", async () => {
    const tranche = makeSignedTranche("t0", 0, "50");
    const grant = makeGrant([tranche]);
    const { deps, submit } = makeDeps();

    const partialRun: CoordinatorRun = {
      id: "run-1",
      positionId: grant.positionId,
      grantId: grant.id,
      reason: "deleverage-guard",
      triggeredAt: Date.now(),
      updatedAt: Date.now(),
      status: "in_progress",
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      trancheIdsPlanned: ["t0"],
      steps: [
        {
          idempotencyKey: "run-1:t0:t0-step-0",
          trancheId: "t0",
          stepId: "t0-step-0",
          status: "completed",
          txHash: "hash-xdr-t0-0",
          confirmedAt: 1,
        },
        {
          idempotencyKey: "run-1:t0:t0-step-1",
          trancheId: "t0",
          stepId: "t0-step-1",
          status: "pending",
        },
      ],
    };
    await deps.store.saveRun(partialRun);

    const run = await runCoordinatorUnwind(deps, {
      grant,
      selection: selectionFor("t0"),
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      existingRun: partialRun,
    });

    expect(run.status).toBe("completed");
    // Only the still-pending step (t0-step-1) is submitted — the completed
    // one is never touched again.
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("xdr-t0-1", "net");
  });

  it("marks the run failed and stops (leaving later steps pending) when a step's submission throws", async () => {
    const tranche = makeSignedTranche("t0", 0, "50");
    const grant = makeGrant([tranche]);
    const submit = vi.fn().mockRejectedValueOnce(new Error("network blip"));
    const store = new InMemoryCoordinatorLedgerStore();
    const deps: CoordinatorExecutionDeps = {
      store,
      transports: {
        rpc: { submit, confirm: vi.fn() },
        soroswapApi: { submit, confirm: vi.fn() },
      },
    };

    const run = await runCoordinatorUnwind(deps, {
      grant,
      selection: selectionFor("t0"),
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
    });

    expect(run.status).toBe("failed");
    expect(run.steps[0].status).toBe("failed");
    expect(run.steps[1].status).toBe("pending"); // never attempted — well-defined, inspectable partial state
    const savedGrant = await deps.store.getGrant(grant.positionId);
    expect(savedGrant).toBeNull(); // tranche never marked consumed since it didn't fully complete
  });

  it("rejects a selection referencing a tranche that isn't part of the grant (wrong position/grant)", async () => {
    const grant = makeGrant([makeSignedTranche("t0", 0, "50")]);
    const { deps } = makeDeps();

    await expect(
      runCoordinatorUnwind(deps, {
        grant,
        selection: selectionFor("tranche-from-a-different-position"),
        healthFactorAtTrigger: 1.05,
        healthFactorTarget: 1.2,
      })
    ).rejects.toThrow(DelegationScopeViolationError);
  });

  it("resumes a multi-tranche run whose FIRST tranche was already marked consumed by that same run's earlier progress", async () => {
    // Two tranches selected in one run; t0 fully completed (and thus
    // already marked consumed) on an earlier tick before a crash, t1 still
    // pending. Resuming must NOT reject t0 as "already consumed" just
    // because it's a member of consumedTrancheIds by now.
    const t0 = makeSignedTranche("t0", 0, "30", 1);
    const t1 = makeSignedTranche("t1", 1, "40", 1);
    const grantAfterT0Consumed: DelegationGrant = {
      ...makeGrant([t0, t1]),
      consumedTrancheIds: ["t0"],
    };
    const { deps, submit } = makeDeps();

    const partialRun: CoordinatorRun = {
      id: "run-1",
      positionId: grantAfterT0Consumed.positionId,
      grantId: grantAfterT0Consumed.id,
      reason: "deleverage-guard",
      triggeredAt: Date.now(),
      updatedAt: Date.now(),
      status: "in_progress",
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      trancheIdsPlanned: ["t0", "t1"],
      steps: [
        {
          idempotencyKey: "run-1:t0:t0-step-0",
          trancheId: "t0",
          stepId: "t0-step-0",
          status: "completed",
          txHash: "hash-xdr-t0-0",
          confirmedAt: 1,
        },
        {
          idempotencyKey: "run-1:t1:t1-step-0",
          trancheId: "t1",
          stepId: "t1-step-0",
          status: "pending",
        },
      ],
    };
    await deps.store.saveRun(partialRun);

    const run = await runCoordinatorUnwind(deps, {
      grant: grantAfterT0Consumed,
      selection: selectionFor("t0", "t1"),
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      existingRun: partialRun,
    });

    expect(run.status).toBe("completed");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("xdr-t1-0", "net");
  });

  it("rejects a selection referencing an already-consumed tranche (never re-unwinds beyond what was needed)", async () => {
    const tranche = makeSignedTranche("t0", 0, "50");
    const grant = { ...makeGrant([tranche]), consumedTrancheIds: ["t0"] };
    const { deps } = makeDeps();

    await expect(
      runCoordinatorUnwind(deps, {
        grant,
        selection: selectionFor("t0"),
        healthFactorAtTrigger: 1.05,
        healthFactorTarget: 1.2,
      })
    ).rejects.toThrow(DelegationScopeViolationError);
  });

  it("rejects resuming a run that belongs to a different grant or position", async () => {
    const grant = makeGrant([makeSignedTranche("t0", 0, "50")]);
    const { deps } = makeDeps();
    const foreignRun: CoordinatorRun = {
      id: "run-x",
      positionId: "some-other-position",
      grantId: "some-other-grant",
      reason: "deleverage-guard",
      triggeredAt: 0,
      updatedAt: 0,
      status: "in_progress",
      healthFactorAtTrigger: null,
      healthFactorTarget: 1.2,
      trancheIdsPlanned: ["t0"],
      steps: [],
    };

    await expect(
      runCoordinatorUnwind(deps, {
        grant,
        selection: selectionFor("t0"),
        healthFactorAtTrigger: 1.05,
        healthFactorTarget: 1.2,
        existingRun: foreignRun,
      })
    ).rejects.toThrow(DelegationScopeViolationError);
  });
});

describe("reconcileCoordinatorRun", () => {
  it("marks a crashed in-flight step completed once chain state confirms it actually succeeded", async () => {
    const run: CoordinatorRun = {
      id: "run-1",
      positionId: "p1",
      grantId: "g1",
      reason: "deleverage-guard",
      triggeredAt: 0,
      updatedAt: 0,
      status: "in_progress",
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      trancheIdsPlanned: ["t0"],
      steps: [
        {
          idempotencyKey: "run-1:t0:s0",
          trancheId: "t0",
          stepId: "s0",
          status: "confirming",
          txHash: "hash-1",
        },
      ],
    };

    const reconciled = await reconcileCoordinatorRun(run, {
      getTransactionStatus: async () => "SUCCESS",
    });

    expect(reconciled.steps[0].status).toBe("completed");
  });

  it("marks a crashed in-flight step failed when chain state confirms it actually failed", async () => {
    const run: CoordinatorRun = {
      id: "run-1",
      positionId: "p1",
      grantId: "g1",
      reason: "deleverage-guard",
      triggeredAt: 0,
      updatedAt: 0,
      status: "in_progress",
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      trancheIdsPlanned: ["t0"],
      steps: [
        {
          idempotencyKey: "run-1:t0:s0",
          trancheId: "t0",
          stepId: "s0",
          status: "submitting",
          txHash: "hash-1",
        },
      ],
    };

    const reconciled = await reconcileCoordinatorRun(run, {
      getTransactionStatus: async () => "FAILED",
    });

    expect(reconciled.steps[0].status).toBe("failed");
  });

  it("leaves a still-genuinely-pending step untouched so a later resume can retry", async () => {
    const run: CoordinatorRun = {
      id: "run-1",
      positionId: "p1",
      grantId: "g1",
      reason: "deleverage-guard",
      triggeredAt: 0,
      updatedAt: 0,
      status: "in_progress",
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      trancheIdsPlanned: ["t0"],
      steps: [
        {
          idempotencyKey: "run-1:t0:s0",
          trancheId: "t0",
          stepId: "s0",
          status: "confirming",
          txHash: "hash-1",
        },
      ],
    };

    const reconciled = await reconcileCoordinatorRun(run, {
      getTransactionStatus: async () => "PENDING",
    });

    expect(reconciled.steps[0].status).toBe("confirming");
  });

  it("full crash-resume flow: reconcile then resume ends the run completed without duplicate submission", async () => {
    const tranche = makeSignedTranche("t0", 0, "50");
    const grant = makeGrant([tranche]);
    const { deps, submit } = makeDeps();

    const crashedRun: CoordinatorRun = {
      id: "run-1",
      positionId: grant.positionId,
      grantId: grant.id,
      reason: "deleverage-guard",
      triggeredAt: Date.now(),
      updatedAt: Date.now(),
      status: "in_progress",
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      trancheIdsPlanned: ["t0"],
      steps: [
        {
          idempotencyKey: "run-1:t0:t0-step-0",
          trancheId: "t0",
          stepId: "t0-step-0",
          status: "confirming", // process died right after submit, before the confirm write
          txHash: "hash-xdr-t0-0",
        },
        {
          idempotencyKey: "run-1:t0:t0-step-1",
          trancheId: "t0",
          stepId: "t0-step-1",
          status: "pending",
        },
      ],
    };

    const reconciled = await reconcileCoordinatorRun(crashedRun, {
      getTransactionStatus: async () => "SUCCESS", // it actually landed before the crash
    });
    await deps.store.saveRun(reconciled);

    const run = await runCoordinatorUnwind(deps, {
      grant,
      selection: selectionFor("t0"),
      healthFactorAtTrigger: 1.05,
      healthFactorTarget: 1.2,
      existingRun: reconciled,
    });

    expect(run.status).toBe("completed");
    // Step 0 was reconciled as already-completed — never resubmitted.
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith("xdr-t0-1", "net");
  });
});
