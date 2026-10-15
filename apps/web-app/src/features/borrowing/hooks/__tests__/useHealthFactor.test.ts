import { describe, it, expect } from "vitest";
// Health-factor math lives in the risk-threshold constants module;
// useHealthFactor.ts re-exports these two helpers for consumers.
import {
  getHealthFactorColor,
  getHealthFactorLabel,
} from "../../const/riskThresholds";

// ─── getHealthFactorLabel ────────────────────────────────────────────────────

describe("getHealthFactorLabel", () => {
  it("returns 'No Position' for null", () => {
    expect(getHealthFactorLabel(null)).toBe("No Position");
  });

  it("returns 'Safe' at or above 1.5", () => {
    expect(getHealthFactorLabel(1.5)).toBe("Safe");
    expect(getHealthFactorLabel(2.75)).toBe("Safe");
  });

  it("returns 'Caution' between 1.0 (inclusive) and 1.5", () => {
    expect(getHealthFactorLabel(1.0)).toBe("Caution");
    expect(getHealthFactorLabel(1.2)).toBe("Caution");
    expect(getHealthFactorLabel(1.49)).toBe("Caution");
  });

  it("returns 'At Risk' below 1.0", () => {
    expect(getHealthFactorLabel(0.99)).toBe("At Risk");
    expect(getHealthFactorLabel(0)).toBe("At Risk");
  });
});

// ─── getHealthFactorColor ────────────────────────────────────────────────────

describe("getHealthFactorColor", () => {
  it("returns the muted class for null", () => {
    expect(getHealthFactorColor(null)).toBe("text-white/40");
  });

  it("returns green at or above 1.5", () => {
    expect(getHealthFactorColor(1.5)).toBe("text-green-400");
  });

  it("returns yellow between 1.0 (inclusive) and 1.5", () => {
    expect(getHealthFactorColor(1.0)).toBe("text-yellow-400");
    expect(getHealthFactorColor(1.49)).toBe("text-yellow-400");
  });

  it("returns red below 1.0", () => {
    expect(getHealthFactorColor(0.99)).toBe("text-red-400");
  });
});
