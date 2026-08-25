import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RampApiError } from "../rampApi";

describe("rampApi apiFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("throws TIMEOUT when the client deadline fires", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const { getOnRampTransaction } = await import("../rampApi");
    const assertion = expect(
      getOnRampTransaction("etherfuse", "tx-1", { timeoutMs: 50 })
    ).rejects.toMatchObject({
      code: "TIMEOUT",
      status: 504,
    });

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it("rethrows AbortError when the caller aborts", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        })
    );

    const { getOnRampTransaction } = await import("../rampApi");
    const controller = new AbortController();
    const promise = getOnRampTransaction("etherfuse", "tx-1", {
      signal: controller.signal,
      timeoutMs: 5_000,
    });

    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not resolve with a body after abort", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise<Response>((resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
        setTimeout(() => {
          resolve(
            new Response(JSON.stringify({ id: "tx-1", status: "completed" }), {
              status: 200,
            })
          );
        }, 1_000);
      });
    });

    const { getOnRampTransaction } = await import("../rampApi");
    const controller = new AbortController();
    const promise = getOnRampTransaction("etherfuse", "tx-1", {
      signal: controller.signal,
      timeoutMs: 5_000,
    });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("maps server TIMEOUT responses to RampApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "timed out", code: "TIMEOUT" }), {
        status: 504,
      })
    );

    const { getOnRampTransaction } = await import("../rampApi");

    await expect(
      getOnRampTransaction("etherfuse", "tx-1")
    ).rejects.toBeInstanceOf(RampApiError);
  });
});
