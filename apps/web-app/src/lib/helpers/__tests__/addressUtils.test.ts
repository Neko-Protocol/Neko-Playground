import { describe, it, expect } from "vitest";
import { formatNetworkName } from "../addressUtils";

describe("formatNetworkName", () => {
  it("maps STANDALONE to Local", () => {
    expect(formatNetworkName("STANDALONE")).toBe("Local");
  });

  it("title-cases the network name", () => {
    expect(formatNetworkName("TESTNET")).toBe("Testnet");
    expect(formatNetworkName("MAINNET")).toBe("Mainnet");
  });

  it("handles mixed-case input", () => {
    expect(formatNetworkName("testnet")).toBe("Testnet");
  });
});
