import { describe, it, expect } from "vitest";
import { getSpendableXlmAmount } from "./xlmSpendable";
import { XLM_FEE_BUFFER } from "../constants/swapConfig";

describe("getSpendableXlmAmount", () => {
  it("subtracts the fee buffer from the reserve-adjusted balance", () => {
    // e.g. user has 10 XLM after reserve subtraction
    const result = getSpendableXlmAmount("10");
    expect(parseFloat(result)).toBeCloseTo(10 - XLM_FEE_BUFFER, 7);
  });

  it("returns '0' when balance is zero", () => {
    expect(getSpendableXlmAmount("0")).toBe("0");
  });

  it("returns '0' when balance is undefined", () => {
    expect(getSpendableXlmAmount(undefined)).toBe("0");
  });

  it("returns '0' when balance is less than the fee buffer", () => {
    // balance smaller than fee buffer → spendable clamped to 0
    const tinyBalance = (XLM_FEE_BUFFER / 2).toString();
    expect(getSpendableXlmAmount(tinyBalance)).toBe("0");
  });

  it("returns '0' for negative balance", () => {
    expect(getSpendableXlmAmount("-5")).toBe("0");
  });

  it("handles large balances correctly", () => {
    const result = getSpendableXlmAmount("1000");
    expect(parseFloat(result)).toBeCloseTo(1000 - XLM_FEE_BUFFER, 7);
  });

  it("does not affect non-XLM tokens (caller responsibility, but pure function is correct)", () => {
    // The function only receives the already-filtered balance; ensure precision
    const result = getSpendableXlmAmount("5.1234567");
    expect(parseFloat(result)).toBeCloseTo(5.1234567 - XLM_FEE_BUFFER, 7);
  });
});
