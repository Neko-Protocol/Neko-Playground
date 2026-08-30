import { describe, it, expect } from "vitest";
import { mapContractError } from "../contractErrors";

describe("mapContractError", () => {
  it("maps #72 to withdrawal_queue_not_expired", () => {
    const err = new Error("HostError: Error(Contract, #72)");
    const mapped = mapContractError(err, "rwa-lending");
    expect(mapped).toEqual({
      kind: "withdrawal_queue_not_expired",
      message: "Withdrawal queue has not expired yet",
    });
  });

  it("maps InsufficientBalance (#1) to insufficient_balance", () => {
    const err = new Error("Error(Contract, #1)");
    const mapped = mapContractError(err, "rwa-token");
    expect(mapped?.kind).toBe("insufficient_balance");
    expect(mapped?.message).toBe("Insufficient token balance");
  });

  it("maps Unauthorized to unauthorized", () => {
    const err = new Error("HostError: Unauthorized access");
    const mapped = mapContractError(err);
    expect(mapped?.kind).toBe("unauthorized");
  });

  it("returns null for user cancellation", () => {
    const err = new Error("User rejected the request");
    expect(mapContractError(err)).toBeNull();
  });

  it("falls back to other for unmapped contract codes", () => {
    const err = new Error("Error(Contract, #99)");
    const mapped = mapContractError(err);
    expect(mapped?.kind).toBe("other");
    expect(mapped?.code).toBe(99);
  });
});
