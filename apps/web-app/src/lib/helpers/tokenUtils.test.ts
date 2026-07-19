import { describe, it, expect } from "vitest";
import { toSmallestUnit } from "./tokenUtils";

describe("toSmallestUnit", () => {
  it("does not lose precision on 0.41 (regression for #257)", () => {
    expect(toSmallestUnit("0.41", 7)).toBe(4100000n);
  });

  it("returns bigint", () => {
    expect(typeof toSmallestUnit("1", 7)).toBe("bigint");
  });

  it("handles whole numbers", () => {
    expect(toSmallestUnit("5", 7)).toBe(50000000n);
    expect(toSmallestUnit("100", 7)).toBe(1000000000n);
  });

  it("handles exact decimals", () => {
    expect(toSmallestUnit("0.0000001", 7)).toBe(1n);
    expect(toSmallestUnit("1.2345678", 7)).toBe(12345678n);
  });

  it("truncates (floors) excess fractional digits", () => {
    expect(toSmallestUnit("0.00000001", 7)).toBe(0n);
    expect(toSmallestUnit("1.23456789", 7)).toBe(12345678n);
  });

  it("handles empty and non-numeric input as 0n", () => {
    expect(toSmallestUnit("", 7)).toBe(0n);
    expect(toSmallestUnit("abc", 7)).toBe(0n);
  });

  it("handles zero and leading zeros", () => {
    expect(toSmallestUnit("0", 7)).toBe(0n);
    expect(toSmallestUnit("00.50", 7)).toBe(5000000n);
  });

  it("handles number input", () => {
    expect(toSmallestUnit(0.41, 7)).toBe(4100000n);
    expect(toSmallestUnit(5, 7)).toBe(50000000n);
  });

  it("respects custom decimals", () => {
    expect(toSmallestUnit("1.5", 2)).toBe(150n);
    expect(toSmallestUnit("1.999", 2)).toBe(199n);
  });

  it("handles a trailing dot and no fraction", () => {
    expect(toSmallestUnit("7.", 7)).toBe(70000000n);
  });

  it("handles number input in exponential notation", () => {
    expect(toSmallestUnit(0.0000001, 7)).toBe(1n); // (0.0000001).toString() === "1e-7"
    expect(toSmallestUnit(1e-7, 7)).toBe(1n);
  });

  it("handles string input in exponential notation", () => {
    expect(toSmallestUnit("1e-7", 7)).toBe(1n);
    expect(toSmallestUnit("1.5e2", 7)).toBe(1500000000n); // 150
  });

  it("does not crash on large-magnitude number input", () => {
    expect(toSmallestUnit(1e21, 7)).toBe(10000000000000000000000000000n);
  });
});
