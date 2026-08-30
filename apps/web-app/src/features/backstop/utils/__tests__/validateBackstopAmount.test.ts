import { describe, it, expect } from "vitest";
import { validateBackstopAmount } from "../validateBackstopAmount";

const base = {
  walletBalance: "100",
  activeDepositAmount: "50",
  queuedDepositAmount: "25",
};

describe("validateBackstopAmount", () => {
  it("rejects empty or non-positive amounts", () => {
    expect(
      validateBackstopAmount({ ...base, action: "deposit", amount: "" })
    ).toEqual({
      valid: false,
      message: "Enter an amount greater than zero.",
    });
    expect(
      validateBackstopAmount({ ...base, action: "deposit", amount: "0" })
    ).toEqual({
      valid: false,
      message: "Enter an amount greater than zero.",
    });
  });

  it("rejects deposit above wallet balance", () => {
    const result = validateBackstopAmount({
      ...base,
      action: "deposit",
      amount: "150",
    });
    expect(result).toEqual({
      valid: false,
      message: "Amount exceeds wallet balance (100).",
    });
  });

  it("rejects queue above active deposit", () => {
    const result = validateBackstopAmount({
      ...base,
      action: "queue",
      amount: "75",
    });
    expect(result).toEqual({
      valid: false,
      message: "Amount exceeds active deposit (50).",
    });
  });

  it("rejects withdraw above queued deposit", () => {
    const result = validateBackstopAmount({
      ...base,
      action: "withdraw",
      amount: "30",
    });
    expect(result).toEqual({
      valid: false,
      message: "Amount exceeds queued deposit (25).",
    });
  });

  it("accepts valid amounts within limits", () => {
    expect(
      validateBackstopAmount({ ...base, action: "deposit", amount: "10" })
    ).toEqual({ valid: true });
    expect(
      validateBackstopAmount({ ...base, action: "queue", amount: "10" })
    ).toEqual({ valid: true });
    expect(
      validateBackstopAmount({ ...base, action: "withdraw", amount: "10" })
    ).toEqual({ valid: true });
  });
});
