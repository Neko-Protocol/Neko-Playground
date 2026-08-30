import { describe, it, expect } from "vitest";
import { usdToStroops } from "../amount";

describe("usdToStroops", () => {
  it("converts a USD amount to 7-decimal stroops", () => {
    expect(usdToStroops(1)).toBe(10_000_000n);
    expect(usdToStroops(12.5)).toBe(125_000_000n);
  });

  it("rounds to the nearest stroop", () => {
    expect(usdToStroops(0.00000001)).toBe(0n);
    expect(usdToStroops(0.000000051)).toBe(1n);
  });

  it("takes the absolute value of a negative (withdrawal) amount", () => {
    expect(usdToStroops(-5)).toBe(50_000_000n);
  });
});
