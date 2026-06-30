/**
 * Unit tests for liquidation-price math utilities.
 *
 * Written for Vitest — the test runner is not yet configured in this project
 * (tracked by issue #241).  Once the harness lands these tests will run as-is.
 */

import { describe, it, expect } from "vitest";
import {
  calculateProjectedHealthFactor,
  calculateLiquidationPrice,
  getRiskTier,
  getPositionWarnings,
} from "../liquidationPrice";

// ─── calculateProjectedHealthFactor ──────────────────────────────────────────

describe("calculateProjectedHealthFactor", () => {
  it("returns null when debt is zero (no risk)", () => {
    expect(calculateProjectedHealthFactor(100, 0, 75)).toBeNull();
  });

  it("returns 0 when collateral is zero but debt is positive", () => {
    expect(calculateProjectedHealthFactor(0, 50, 75)).toBe(0);
  });

  it("calculates correctly for a normal position", () => {
    // HF = (100 × 0.75) / 50 = 1.5
    expect(calculateProjectedHealthFactor(100, 50, 75)).toBeCloseTo(1.5);
  });

  it("returns under 1 for an under-collateralised position", () => {
    // HF = (100 × 0.75) / 100 = 0.75
    expect(calculateProjectedHealthFactor(100, 100, 75)).toBeCloseTo(0.75);
  });

  it("returns 0 for negative collateral", () => {
    expect(calculateProjectedHealthFactor(-10, 50, 75)).toBe(0);
  });

  it("returns null for negative debt", () => {
    expect(calculateProjectedHealthFactor(100, -50, 75)).toBeNull();
  });

  it("returns 0 when collateral factor is zero", () => {
    expect(calculateProjectedHealthFactor(100, 50, 0)).toBe(0);
  });
});

// ─── calculateLiquidationPrice ───────────────────────────────────────────────

describe("calculateLiquidationPrice", () => {
  it("calculates liquidation price correctly", () => {
    // liqPrice = 50 / (100 × 0.75) = 0.6667
    const result = calculateLiquidationPrice(100, 50, 75);
    expect(result).toBeCloseTo(0.6667, 3);
  });

  it("returns null when debt is zero", () => {
    expect(calculateLiquidationPrice(100, 0, 75)).toBeNull();
  });

  it("returns null when collateral is zero", () => {
    expect(calculateLiquidationPrice(0, 50, 75)).toBeNull();
  });

  it("returns null for negative collateral amount", () => {
    expect(calculateLiquidationPrice(-10, 50, 75)).toBeNull();
  });

  it("higher debt produces a higher liquidation price", () => {
    const lowDebt = calculateLiquidationPrice(100, 30, 75)!;
    const highDebt = calculateLiquidationPrice(100, 60, 75)!;
    expect(highDebt).toBeGreaterThan(lowDebt);
  });
});

// ─── getRiskTier ─────────────────────────────────────────────────────────────

describe("getRiskTier", () => {
  it("returns 'unknown' for null", () => {
    expect(getRiskTier(null)).toBe("unknown");
  });

  it("returns 'safe' for HF >= 1.5", () => {
    expect(getRiskTier(2.0)).toBe("safe");
    expect(getRiskTier(1.5)).toBe("safe"); // boundary
  });

  it("returns 'caution' for 1.0 <= HF < 1.5", () => {
    expect(getRiskTier(1.3)).toBe("caution");
    expect(getRiskTier(1.0)).toBe("caution"); // boundary
  });

  it("returns 'at-risk' for HF < 1.0", () => {
    expect(getRiskTier(0.9)).toBe("at-risk");
    expect(getRiskTier(0)).toBe("at-risk");
  });
});

// ─── getPositionWarnings ─────────────────────────────────────────────────────

describe("getPositionWarnings", () => {
  it("returns empty array when projectedHF is null", () => {
    expect(getPositionWarnings(null, 2.0)).toEqual([]);
  });

  it("returns a 'block' warning when projected HF < 1.0", () => {
    const warnings = getPositionWarnings(0.8, 2.0);
    expect(warnings.some((w) => w.severity === "block")).toBe(true);
  });

  it("returns a 'warn' when projected HF is between 1.0 and 1.2", () => {
    const warnings = getPositionWarnings(1.1, 2.0);
    expect(warnings.some((w) => w.severity === "warn")).toBe(true);
  });

  it("returns no warnings for a safe-to-safe transition", () => {
    const warnings = getPositionWarnings(2.0, 2.0);
    expect(warnings).toEqual([]);
  });

  it("includes tier transition warning when dropping from safe to caution", () => {
    const warnings = getPositionWarnings(1.3, 2.0);
    expect(
      warnings.some((w) => w.severity === "warn" && w.message.includes("Safe"))
    ).toBe(true);
  });
});
