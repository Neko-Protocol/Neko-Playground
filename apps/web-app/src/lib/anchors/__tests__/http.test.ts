import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  anchorRequest,
  ANCHOR_REQUEST_TIMEOUT_MS,
  anchorErrorResponse,
} from "../http";
import {
  AnchorTimeoutError,
  AnchorUnreachableError,
  AnchorError,
} from "../types";

describe("anchorRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("throws AnchorTimeoutError when the deadline fires", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const assertion = expect(
      anchorRequest("https://anchor.test/api", {}, { timeoutMs: 50 })
    ).rejects.toBeInstanceOf(AnchorTimeoutError);

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

    const controller = new AbortController();
    const promise = anchorRequest(
      "https://anchor.test/api",
      {},
      { timeoutMs: ANCHOR_REQUEST_TIMEOUT_MS, signal: controller.signal }
    );

    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("cleans up timers after completion", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await anchorRequest("https://anchor.test/api", {}, { timeoutMs: 100 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("throws AnchorUnreachableError on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed")
    );

    await expect(
      anchorRequest("https://anchor.test/api", {}, { timeoutMs: 100 })
    ).rejects.toBeInstanceOf(AnchorUnreachableError);
  });
});

describe("anchorErrorResponse", () => {
  it("maps timeout to 504", async () => {
    const response = anchorErrorResponse(new AnchorTimeoutError());
    expect(response?.status).toBe(504);
    const body = await response!.json();
    expect(body.code).toBe("TIMEOUT");
  });

  it("maps unreachable to 503", async () => {
    const response = anchorErrorResponse(new AnchorUnreachableError());
    expect(response?.status).toBe(503);
    const body = await response!.json();
    expect(body.code).toBe("UNREACHABLE");
  });

  it("returns null for client abort", () => {
    const response = anchorErrorResponse(
      new DOMException("Aborted", "AbortError")
    );
    expect(response).toBeNull();
  });

  it("preserves other AnchorError status codes", async () => {
    const response = anchorErrorResponse(
      new AnchorError("Not found", "NOT_FOUND", 404)
    );
    expect(response?.status).toBe(404);
  });
});
