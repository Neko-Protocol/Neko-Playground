import { describe, expect, it } from "vitest";
import {
  computeGrantRiskSnapshot,
  computeRequiredDebtReliefUsd,
  evaluatePosition,
  hasRecovered,
  shouldTriggerUnwind,
} from "../deleverageGuard";
import type { DelegationGrant, DelegationTrancheRecord } from "../types";

const config = { deleverageThreshold: 1.15, hysteresis: 0.05 };

function makeGrant(overrides: Partial<DelegationGrant> = {}): DelegationGrant {
  return {
    id: "g1",
    positionId: "p1",
    walletAddress: "GUSER",
    assetCode: "USTRY",
    borrowAssetCode: "USDC",
    status: "active",
    createdAt: 0,
    expiresAt: Date.now() + 1_000_000,
    tranches: [],
    consumedTrancheIds: [],
    guardConfig: {
      deleverageThreshold: config.deleverageThreshold,
      hysteresis: config.hysteresis,
    },
    breached: false,
    ...overrides,
  };
}

describe("shouldTriggerUnwind / hasRecovered", () => {
  it("triggers exactly at (just below) the configured threshold, not above it", () => {
    expect(shouldTriggerUnwind(1.1499999, 1.15)).toBe(true);
    expect(shouldTriggerUnwind(1.15, 1.15)).toBe(false);
    expect(shouldTriggerUnwind(1.2, 1.15)).toBe(false);
    expect(shouldTriggerUnwind(null, 1.15)).toBe(false);
  });

  it("only recovers once HF clears threshold + hysteresis", () => {
    expect(hasRecovered(1.19, 1.15, 0.05)).toBe(false); // still below 1.20
    expect(hasRecovered(1.2, 1.15, 0.05)).toBe(true);
    expect(hasRecovered(1.25, 1.15, 0.05)).toBe(true);
  });
});

describe("computeRequiredDebtReliefUsd", () => {
  it("solves for the exact debt relief that brings HF to the target, verified by reapplying it", () => {
    const collateralValueUsd = 1000;
    const debtValueUsd = 681.8181818;
    const cf = 75;
    const target = 1.2;

    const relief = computeRequiredDebtReliefUsd(
      collateralValueUsd,
      debtValueUsd,
      cf,
      target
    );

    const newCollateral = collateralValueUsd - relief / (cf / 100);
    const newDebt = debtValueUsd - relief;
    const newHf = (newCollateral * (cf / 100)) / newDebt;
    expect(newHf).toBeCloseTo(target, 4);
  });

  it("never returns more relief than there is outstanding debt", () => {
    const relief = computeRequiredDebtReliefUsd(100, 50, 10, 5); // pathological: tiny CF, huge target
    expect(relief).toBeLessThanOrEqual(50);
    expect(relief).toBeGreaterThanOrEqual(0);
  });

  it("returns 0 when the position is already healthier than the target (no relief needed)", () => {
    const relief = computeRequiredDebtReliefUsd(1690, 70, 75, 1.2);
    expect(relief).toBe(0);
  });
});

describe("evaluatePosition", () => {
  const grant = makeGrant();

  it("holds when health factor is above the deleverage threshold", () => {
    const action = evaluatePosition(
      {
        healthFactor: 1.3,
        collateralValueUsd: 1000,
        debtValueUsd: 500,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: 1,
      },
      grant,
      false,
      config
    );
    expect(action.kind).toBe("hold");
  });

  it("triggers an unwind sized to clear the breach when HF is below threshold and delegation is usable", () => {
    const action = evaluatePosition(
      {
        healthFactor: 1.1,
        collateralValueUsd: 1000,
        debtValueUsd: 681.8181818,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: 1,
      },
      grant,
      false,
      config
    );
    expect(action.kind).toBe("trigger-unwind");
    if (action.kind !== "trigger-unwind") return;
    expect(action.requiredDebtReliefUnits).toBeGreaterThan(0);
    expect(action.targetHealthFactor).toBeCloseTo(1.2, 6);
  });

  it("reports recovered once a previously-breached position clears threshold + hysteresis", () => {
    const action = evaluatePosition(
      {
        healthFactor: 1.21,
        collateralValueUsd: 1000,
        debtValueUsd: 500,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: 1,
      },
      grant,
      true, // wasBreached
      config
    );
    expect(action.kind).toBe("recovered");
  });

  it("does NOT report recovered for a position that was never breached, even above threshold+hysteresis", () => {
    const action = evaluatePosition(
      {
        healthFactor: 1.21,
        collateralValueUsd: 1000,
        debtValueUsd: 500,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: 1,
      },
      grant,
      false,
      config
    );
    expect(action.kind).toBe("hold");
  });

  it("falls back to alert-only when no delegation has been granted", () => {
    const action = evaluatePosition(
      {
        healthFactor: 1.1,
        collateralValueUsd: 1000,
        debtValueUsd: 700,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: 1,
      },
      null,
      false,
      config
    );
    expect(action.kind).toBe("alert-only");
  });

  it("falls back to alert-only when the delegation was revoked", () => {
    const action = evaluatePosition(
      {
        healthFactor: 1.1,
        collateralValueUsd: 1000,
        debtValueUsd: 700,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: 1,
      },
      makeGrant({ status: "revoked" }),
      false,
      config
    );
    expect(action.kind).toBe("alert-only");
  });

  it("falls back to alert-only when the delegation has expired", () => {
    const action = evaluatePosition(
      {
        healthFactor: 1.1,
        collateralValueUsd: 1000,
        debtValueUsd: 700,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: 1,
      },
      makeGrant({ expiresAt: 0 }),
      false,
      config,
      500 // now > expiresAt
    );
    expect(action.kind).toBe("alert-only");
  });

  it("holds (never crashes) when health factor is unavailable", () => {
    const action = evaluatePosition(
      {
        healthFactor: null,
        collateralValueUsd: null,
        debtValueUsd: null,
        blendedCollateralFactorPct: 75,
        debtAssetPriceUsd: null,
      },
      grant,
      false,
      config
    );
    expect(action.kind).toBe("hold");
  });
});

// ─── computeGrantRiskSnapshot ─────────────────────────────────────────────────

function makeTranche(
  id: string,
  order: number,
  collateralAmount: string,
  debtAmount: string,
  collateralPoolId = "blend:CPOOL:CUSTRY",
  borrowPoolId = "blend:CPOOL:CUSDC"
): DelegationTrancheRecord {
  return {
    id,
    order,
    collateralAmount,
    debtAmount,
    collateralPoolId,
    borrowPoolId,
    steps: [],
  };
}

function makeRiskGrant(
  tranches: DelegationTrancheRecord[],
  consumed: string[] = []
): DelegationGrant {
  return {
    id: "g1",
    positionId: "p1",
    walletAddress: "GUSER",
    assetCode: "USTRY",
    borrowAssetCode: "USDC",
    status: "active",
    createdAt: 0,
    expiresAt: Date.now() + 1_000_000,
    tranches,
    consumedTrancheIds: consumed,
    guardConfig: { deleverageThreshold: 1.15, hysteresis: 0.05 },
    breached: false,
  };
}

describe("computeGrantRiskSnapshot", () => {
  it("sums live collateral/debt across every distinct pool touched by unconsumed tranches", async () => {
    const g = makeRiskGrant([
      makeTranche("t0", 0, "100", "70"),
      makeTranche("t1", 1, "60", "42", "neko:USTRY", "neko:USDC"),
    ]);

    const reads: Record<
      string,
      { collateralUnits: number; debtUnits: number }
    > = {
      "blend:CPOOL:CUSTRY": { collateralUnits: 150, debtUnits: 0 },
      "blend:CPOOL:CUSDC": { collateralUnits: 0, debtUnits: 100 },
      "neko:USTRY": { collateralUnits: 65, debtUnits: 0 },
      "neko:USDC": { collateralUnits: 0, debtUnits: 45 },
    };

    const snapshot = await computeGrantRiskSnapshot(
      g,
      async (poolId) => reads[poolId] ?? null,
      (code) => (code === "USTRY" ? 10 : code === "USDC" ? 1 : null)
    );

    expect(snapshot.collateralValueUsd).toBeCloseTo((150 + 65) * 10, 6);
    expect(snapshot.debtValueUsd).toBeCloseTo((100 + 45) * 1, 6);
    expect(snapshot.healthFactor).not.toBeNull();
  });

  it("excludes already-consumed tranches' pools from the live snapshot", async () => {
    const g = makeRiskGrant(
      [
        makeTranche("t0", 0, "100", "70"),
        makeTranche("t1", 1, "60", "42", "neko:USTRY", "neko:USDC"),
      ],
      ["t1"]
    );

    let readCount = 0;
    const snapshot = await computeGrantRiskSnapshot(
      g,
      async (poolId) => {
        readCount += 1;
        expect(poolId.startsWith("neko:")).toBe(false); // consumed tranche's pools never read
        return { collateralUnits: 100, debtUnits: 70 };
      },
      () => 1
    );

    expect(readCount).toBe(2); // only t0's collateral + borrow pool
    expect(snapshot.debtValueUsd).toBeCloseTo(70, 6);
  });

  it("returns a null-risk snapshot (never throws) when every tranche is already consumed", async () => {
    const g = makeRiskGrant([makeTranche("t0", 0, "100", "70")], ["t0"]);
    const snapshot = await computeGrantRiskSnapshot(
      g,
      async () => {
        throw new Error("should never be called");
      },
      () => 1
    );
    expect(snapshot.healthFactor).toBeNull();
  });

  it("degrades gracefully (doesn't crash) when collateral is unreadable — undercounts collateral, the conservative direction", async () => {
    const g = makeRiskGrant([makeTranche("t0", 0, "100", "70")]);
    const snapshot = await computeGrantRiskSnapshot(
      g,
      async () => null,
      () => 1
    );
    expect(snapshot.collateralValueUsd).toBe(0);
  });

  it("falls back to the tranche's static debtAmount (never a silent zero) when a debt read is unreadable", async () => {
    // Zeroing unreadable DEBT would make health factor look artificially
    // healthy and could suppress a real breach — the dangerous direction.
    const g = makeRiskGrant([makeTranche("t0", 0, "100", "70")]);
    const snapshot = await computeGrantRiskSnapshot(
      g,
      async () => null,
      () => 1
    );
    expect(snapshot.debtValueUsd).toBe(70);
  });

  it("returns a conservative (slightly-below-true) blended collateral factor derived from the loop's own effective LTV", async () => {
    // debt/collateral = 70/100 = 70% effective LTV — always <= the pool's
    // real max LTV by construction (loopSizing subtracts the safety buffer).
    const g = makeRiskGrant([makeTranche("t0", 0, "100", "70")]);
    const snapshot = await computeGrantRiskSnapshot(
      g,
      async () => ({ collateralUnits: 100, debtUnits: 70 }),
      () => 1
    );
    expect(snapshot.blendedCollateralFactorPct).toBeCloseTo(70, 6);
  });
});
