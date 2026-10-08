import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_USER_ERROR_MESSAGE,
  getUserFacingErrorMessage,
  reportAppError,
} from "../normalizeAppError";
import { AdapterError } from "../../orchestrator/types/errors";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getUserFacingErrorMessage", () => {
  it("preserves the curated userMessage from a real AdapterError", () => {
    const error = new AdapterError(
      "blend",
      "deposit",
      new Error("simulation failed")
    );

    expect(getUserFacingErrorMessage(error)).toBe(error.userMessage);
  });

  it("does not trust a structurally similar arbitrary userMessage", () => {
    expect(
      getUserFacingErrorMessage({
        message: "opaque provider failure",
        userMessage: "internal rpc detail: account=secret",
      })
    ).toBe(DEFAULT_USER_ERROR_MESSAGE);
  });

  it("does not execute hostile error accessors", () => {
    const hostile = {};
    Object.defineProperty(hostile, "userMessage", {
      get: () => {
        throw new Error("userMessage getter executed");
      },
    });
    Object.defineProperty(hostile, "message", {
      get: () => {
        throw new Error("message getter executed");
      },
    });

    expect(getUserFacingErrorMessage(hostile)).toBe(DEFAULT_USER_ERROR_MESSAGE);
  });

  it("normalizes common wallet rejection and network failures", () => {
    expect(getUserFacingErrorMessage(new Error("User rejected request"))).toBe(
      "The wallet request was rejected."
    );
    expect(getUserFacingErrorMessage(new Error("Failed to fetch RPC"))).toBe(
      "Unable to reach the network. Check your connection and try again."
    );
  });

  it("does not expose arbitrary internal error text", () => {
    expect(
      getUserFacingErrorMessage(new Error("postgres password=secret"))
    ).toBe(DEFAULT_USER_ERROR_MESSAGE);
  });

  it("uses a caller-specific fallback when provided", () => {
    expect(
      getUserFacingErrorMessage(new Error("opaque failure"), "Wallet unavailable.")
    ).toBe("Wallet unavailable.");
  });
});

describe("reportAppError", () => {
  it("logs diagnostics while returning only the normalized UI message", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("deadline exceeded");

    expect(reportAppError("wallet.refresh", error)).toBe(
      "The request timed out. Please try again."
    );
    expect(spy).toHaveBeenCalledWith("[wallet.refresh]", error);
  });
});
