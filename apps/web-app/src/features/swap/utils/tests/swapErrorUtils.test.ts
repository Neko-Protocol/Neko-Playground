/**
 * Unit tests for swapErrorUtils
 *
 * Covers:
 *  - User-rejection errors (various wallet / pattern strings)
 *  - Non-rejection errors (pass-through)
 *  - Edge cases: null, undefined, non-Error thrown values
 */

import { describe, it, expect } from "vitest";
import {
  handleSwapError,
  USER_REJECTED_MESSAGE,
} from "../swapErrorUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calls handleSwapError and captures the thrown error. */
function catchSwapError(input: unknown): Error {
  try {
    handleSwapError(input);
    // handleSwapError always throws, so reaching here is a test failure.
    throw new Error("handleSwapError did NOT throw");
  } catch (e) {
    return e as Error;
  }
}

// ---------------------------------------------------------------------------
// User-rejection errors – should be normalised to USER_REJECTED
// ---------------------------------------------------------------------------

describe("handleSwapError – user rejection patterns", () => {
  const rejectionMessages = [
    "User rejected the request",
    "MetaMask: User denied transaction",
    "User declined the transaction",
    "Transaction cancelled by user",
    "Transaction canceled",
    "User cancelled",
    "User canceled",
    "Request rejected",
    "Transaction rejected",
    "Signature rejected",
    "action_cancelled",
    // Numeric MetaMask / JSON-RPC rejection codes
    "Error code 4001: user denied",
    "JsonRpcError -32000: user rejected",
    // Code appears anywhere in the string
    "Something went wrong: 4001",
    "Internal error -32603",
  ];

  for (const msg of rejectionMessages) {
    it(`throws USER_REJECTED for: "${msg}"`, () => {
      const thrown = catchSwapError(new Error(msg));
      expect(thrown.message).toBe(USER_REJECTED_MESSAGE);
    });
  }

  it("is case-insensitive (all-caps USER REJECTED string)", () => {
    const thrown = catchSwapError(new Error("USER REJECTED THE REQUEST"));
    expect(thrown.message).toBe(USER_REJECTED_MESSAGE);
  });

  it("matches when rejection keyword appears mid-string", () => {
    const thrown = catchSwapError(
      new Error("Wallet popup closed; user canceled the flow")
    );
    expect(thrown.message).toBe(USER_REJECTED_MESSAGE);
  });

  it("also works for plain string errors", () => {
    const thrown = catchSwapError("user denied transaction");
    expect(thrown.message).toBe(USER_REJECTED_MESSAGE);
  });
});

// ---------------------------------------------------------------------------
// Non-rejection errors – should be re-thrown as-is
// ---------------------------------------------------------------------------

describe("handleSwapError – non-rejection errors (pass-through)", () => {
  it("re-throws a network error with its original message", () => {
    const original = new Error("Network request failed");
    const thrown = catchSwapError(original);
    expect(thrown).toBe(original); // same reference
    expect(thrown.message).toBe("Network request failed");
  });

  it("re-throws an Error with an RPC error message that is not a rejection", () => {
    const original = new Error("insufficient funds for gas");
    const thrown = catchSwapError(original);
    expect(thrown).toBe(original);
  });

  it("wraps a non-Error thrown string in a new Error", () => {
    const thrown = catchSwapError("slippage too high");
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe("slippage too high");
  });

  it("wraps a thrown number in a new Error", () => {
    const thrown = catchSwapError(42);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toBe("42");
  });

  it("wraps a thrown object in a new Error (stringified)", () => {
    const thrown = catchSwapError({ code: 500, reason: "server error" });
    expect(thrown).toBeInstanceOf(Error);
    // String(plain object) = "[object Object]"
    expect(thrown.message).toBe("[object Object]");
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("handleSwapError – edge cases", () => {
  it("wraps null (falsy) without treating it as USER_REJECTED", () => {
    const thrown = catchSwapError(null);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).not.toBe(USER_REJECTED_MESSAGE);
    expect(thrown.message).toBe("null");
  });

  it("wraps undefined without treating it as USER_REJECTED", () => {
    const thrown = catchSwapError(undefined);
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).not.toBe(USER_REJECTED_MESSAGE);
    expect(thrown.message).toBe("undefined");
  });

  it("wraps an empty string without treating it as USER_REJECTED", () => {
    const thrown = catchSwapError("");
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).not.toBe(USER_REJECTED_MESSAGE);
  });

  it("always throws – never returns normally", () => {
    expect(() => handleSwapError(new Error("boom"))).toThrow();
  });
});
