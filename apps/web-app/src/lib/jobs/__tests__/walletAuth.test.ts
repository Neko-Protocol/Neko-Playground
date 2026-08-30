import { describe, it, expect } from "vitest";
import { requireWalletAddress, MissingWalletAddressError } from "../walletAuth";

const VALID = "GA".padEnd(56, "A");

describe("requireWalletAddress", () => {
  it("accepts a well-formed Stellar public key", () => {
    expect(requireWalletAddress(VALID)).toBe(VALID);
  });

  it("rejects a missing value", () => {
    expect(() => requireWalletAddress(undefined)).toThrow(
      MissingWalletAddressError
    );
  });

  it("rejects a non-string value", () => {
    expect(() => requireWalletAddress(42)).toThrow(MissingWalletAddressError);
  });

  it("rejects a malformed key", () => {
    expect(() => requireWalletAddress("not-a-key")).toThrow(
      MissingWalletAddressError
    );
  });
});
