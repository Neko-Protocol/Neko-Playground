import { describe, expect, it, vi } from "vitest";
import {
  createDelegationGrant,
  isDelegationUsable,
  revokeDelegationGrant,
  selectTranchesToClearBreach,
  signUnwindTranches,
} from "../delegation";
import type { UnwindTranche } from "@/lib/strategy/leverage/buildStrategy";
import type { StrategyStepDefinition, TxResult } from "@/lib/strategy/types";
import type { DelegationGrant, DelegationTrancheRecord } from "../types";

function makeFakeRegistry(): { resolve: () => StrategyStepDefinition } {
  const definition: StrategyStepDefinition = {
    stepType: "repay",
    protocol: "blend",
    submissionMode: "rpc",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    paramsSchema: {} as any,
    describeOutputs: () => [],
    validate: () => [],
    simulate: async () => {
      throw new Error("not used");
    },
    prepare: async (ctx): Promise<TxResult> => ({
      xdr: `xdr-for-${JSON.stringify(ctx.resolvedParams)}`,
      networkPassphrase: "Test SDF Network ; September 2015",
    }),
  };
  return { resolve: vi.fn(() => definition) };
}

function makeTranche(order: number, debtAmount: string): UnwindTranche {
  return {
    id: `tranche-${order}`,
    order,
    collateralAmount: "100",
    debtAmount,
    collateralPoolId: "blend:CPOOL:CUSTRY",
    borrowPoolId: "blend:CPOOL:CUSDC",
    steps: [
      {
        id: `repay-${order}`,
        type: "repay",
        protocol: "blend",
        label: "Repay",
        dependsOn: [],
        params: { amount: { source: "literal", value: debtAmount } },
      },
      {
        id: `withdraw-${order}`,
        type: "supply",
        protocol: "blend",
        label: "Withdraw",
        dependsOn: [`repay-${order}`],
        params: {
          mode: { source: "literal", value: "collateral" },
          direction: { source: "literal", value: "withdraw" },
          amount: { source: "literal", value: "100" },
        },
      },
    ],
  };
}

describe("signUnwindTranches", () => {
  it("signs every literal-bound step of every tranche via the provided SignFn", async () => {
    const registry = makeFakeRegistry();
    const sign = vi.fn(async (xdr: string) => ({
      signedTxXdr: `signed(${xdr})`,
    }));
    const tranches = [makeTranche(0, "50"), makeTranche(1, "70")];

    const records = await signUnwindTranches(
      tranches,
      {
        userAddress: "GUSER",
        networkPassphrase: "Test SDF Network ; September 2015",
      },
      sign,
      "USTRY",
      "USDC",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      registry as any
    );

    expect(records).toHaveLength(2);
    expect(sign).toHaveBeenCalledTimes(4); // 2 steps x 2 tranches
    expect(records[0].steps[0].operationType).toBe("repay");
    expect(records[0].steps[0].assetCode).toBe("USDC");
    expect(records[0].steps[0].amount).toBe("50");
    expect(records[0].steps[0].signedXdr).toMatch(/^signed\(/);
    expect(records[0].steps[1].operationType).toBe("withdrawCollateral");
    expect(records[0].steps[1].assetCode).toBe("USTRY");
  });

  it("throws if a tranche step has a non-literal (stepOutput) binding — it wouldn't be pre-signable", async () => {
    const registry = makeFakeRegistry();
    const sign = vi.fn(async () => ({ signedTxXdr: "x" }));
    const badTranche: UnwindTranche = {
      id: "bad",
      order: 0,
      collateralAmount: "1",
      debtAmount: "1",
      collateralPoolId: "blend:CPOOL:CUSTRY",
      borrowPoolId: "blend:CPOOL:CUSDC",
      steps: [
        {
          id: "s1",
          type: "repay",
          protocol: "blend",
          label: "Repay",
          dependsOn: [],
          params: {
            amount: { source: "stepOutput", stepId: "x", portId: "y" },
          },
        },
      ],
    };

    await expect(
      signUnwindTranches(
        [badTranche],
        { userAddress: "G", networkPassphrase: "net" },
        sign,
        "USTRY",
        "USDC",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        registry as any
      )
    ).rejects.toThrow(/literal/i);
  });
});

function makeGrant(
  overrides: Partial<DelegationGrant> = {},
  tranches: DelegationTrancheRecord[] = []
): DelegationGrant {
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
    ...overrides,
  };
}

function signedTranche(
  id: string,
  order: number,
  debtAmount: string
): DelegationTrancheRecord {
  return {
    id,
    order,
    collateralAmount: "100",
    debtAmount,
    collateralPoolId: "blend:CPOOL:CUSTRY",
    borrowPoolId: "blend:CPOOL:CUSDC",
    steps: [
      {
        stepId: `repay-${id}`,
        operationType: "repay",
        protocol: "blend",
        poolType: "blend",
        assetCode: "USDC",
        amount: debtAmount,
        submissionMode: "rpc",
        signedXdr: `xdr-${id}`,
        networkPassphrase: "net",
      },
    ],
  };
}

describe("createDelegationGrant / revokeDelegationGrant / isDelegationUsable", () => {
  it("creates an active grant with a computed expiry, and revoke marks it unusable", () => {
    const grant = createDelegationGrant({
      positionId: "p1",
      walletAddress: "GUSER",
      assetCode: "USTRY",
      borrowAssetCode: "USDC",
      tranches: [],
      validityMs: 1000,
      now: 500,
    });
    expect(grant.status).toBe("active");
    expect(grant.expiresAt).toBe(1500);
    expect(isDelegationUsable(grant, 600)).toBe(true);
    expect(isDelegationUsable(grant, 1600)).toBe(false); // expired

    const revoked = revokeDelegationGrant(grant, 700);
    expect(revoked.status).toBe("revoked");
    expect(isDelegationUsable(revoked, 600)).toBe(false);
  });

  it("treats a null grant as unusable", () => {
    expect(isDelegationUsable(null)).toBe(false);
  });
});

describe("selectTranchesToClearBreach", () => {
  it("selects the smallest prefix (by order) whose cumulative debt relief clears the requirement", () => {
    const grant = makeGrant({}, [
      signedTranche("t0", 0, "30"),
      signedTranche("t1", 1, "40"),
      signedTranche("t2", 2, "50"),
    ]);
    const selection = selectTranchesToClearBreach(grant, 50);
    expect(selection).not.toBeNull();
    // 30 (t0) + 40 (t1) = 70 >= 50 -> stops there, doesn't touch t2.
    expect(selection?.trancheIds).toEqual(["t0", "t1"]);
  });

  it("never selects a tranche once its cumulative total already clears the requirement", () => {
    const grant = makeGrant({}, [signedTranche("t0", 0, "100")]);
    const selection = selectTranchesToClearBreach(grant, 10);
    expect(selection?.trancheIds).toEqual(["t0"]); // one tranche is enough, and it's all there is
  });

  it("skips already-consumed tranches", () => {
    const grant = makeGrant({ consumedTrancheIds: ["t0"] }, [
      signedTranche("t0", 0, "30"),
      signedTranche("t1", 1, "40"),
    ]);
    const selection = selectTranchesToClearBreach(grant, 10);
    expect(selection?.trancheIds).toEqual(["t1"]);
  });

  it("returns null when the grant is revoked", () => {
    const grant = makeGrant({ status: "revoked" }, [
      signedTranche("t0", 0, "30"),
    ]);
    expect(selectTranchesToClearBreach(grant, 10)).toBeNull();
  });

  it("returns null when the grant is expired", () => {
    const grant = makeGrant({ expiresAt: 100 }, [signedTranche("t0", 0, "30")]);
    expect(selectTranchesToClearBreach(grant, 10, 200)).toBeNull();
  });

  it("returns null when there is nothing left unconsumed to give", () => {
    const grant = makeGrant({ consumedTrancheIds: ["t0"] }, [
      signedTranche("t0", 0, "30"),
    ]);
    expect(selectTranchesToClearBreach(grant, 10)).toBeNull();
  });

  it("returns null for a null grant", () => {
    expect(selectTranchesToClearBreach(null, 10)).toBeNull();
  });
});
