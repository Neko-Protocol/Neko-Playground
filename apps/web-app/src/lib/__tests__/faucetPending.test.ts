import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { Transaction } from "@stellar/stellar-sdk";

const state = vi.hoisted(() => ({
  contractId: "bulk-faucet" as string | undefined,
  tokens: [{ symbol: "TEST", contractId: "token", mintAmount: 1n }],
  send: vi.fn(),
  read: vi.fn(),
  prepare: vi.fn(),
  localHash: "ab".repeat(32),
  remoteHash: "cd".repeat(32),
}));

vi.mock("next/server", () => ({
  NextRequest: Request,
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), init),
  },
}));
vi.mock("@stellar/stellar-sdk", () => {
  class TransactionBuilder {
    addOperation() {
      return this;
    }
    setTimeout() {
      return this;
    }
    build() {
      return { sign() {}, hash: () => Buffer.from(state.localHash, "hex") };
    }
  }
  return {
    TransactionBuilder,
    Keypair: { fromSecret: () => ({ publicKey: () => "admin" }) },
    Contract: class {
      call() {
        return {};
      }
    },
    Address: class {
      toScVal() {
        return {};
      }
    },
    nativeToScVal: () => ({}),
    rpc: {},
    Horizon: {
      Server: class {
        async loadAccount() {
          return {};
        }
      },
    },
  };
});
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@/lib/constants/faucet", () => ({
  FAUCET_COOLDOWN_MS: 60_000,
  getFaucetTokens: () => state.tokens,
  buildMintRequestsScVal: () => ({}),
}));
vi.mock("@/lib/validation/parse", () => ({
  parseJsonBody: async (request: Request) => ({ data: await request.json() }),
}));
vi.mock("@/lib/validation/schemas", () => ({ FaucetBodySchema: {} }));
vi.mock("@/lib/env.client", () => ({
  clientEnv: { stellarNetwork: "TESTNET", networkPassphrase: "test" },
}));
vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    FAUCET_SECRET_KEY: "controlled-test-input",
    get FAUCET_CONTRACT_ID() {
      return state.contractId;
    },
  },
}));
vi.mock("@/lib/helpers/stellar/sorobanServer", () => ({
  getSorobanServer: () => ({
    prepareTransaction: state.prepare,
    sendTransaction: state.send,
    getTransaction: state.read,
  }),
}));

import { POST } from "@/app/api/faucet/route";
import { __resetFaucetRateLimitForTests } from "@/lib/faucetRateLimit";
import { submitFaucetMint } from "@/lib/faucetSubmission";

function request() {
  return new Request("http://localhost/api/faucet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ address: "recipient" }),
  }) as NextRequest;
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["Date", "performance", "setTimeout", "clearTimeout"],
  });
  vi.setSystemTime(new Date("2026-10-04T09:00:00Z"));
  vi.stubEnv("NODE_ENV", "test");
  for (const key of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "KV_REST_API_URL",
    "KV_REST_API_TOKEN",
    "FAUCET_RATE_LIMIT_DISABLED",
  ]) {
    vi.stubEnv(key, "");
  }
  vi.spyOn(console, "warn").mockImplementation(() => {});
  __resetFaucetRateLimitForTests();
  state.tokens = [{ symbol: "TEST", contractId: "token", mintAmount: 1n }];
  state.prepare
    .mockReset()
    .mockImplementation(async (transaction) => transaction);
  state.send
    .mockReset()
    .mockResolvedValue({ status: "PENDING", hash: state.remoteHash });
  state.read.mockReset().mockResolvedValue({ status: "SUCCESS" });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  __resetFaucetRateLimitForTests();
});

it("does not start a submission after its queued RPC reaches the deadline", async () => {
  let monotonicNow = 0;
  vi.spyOn(performance, "now").mockImplementation(() => monotonicNow);
  const pending = submitFaucetMint(
    { sendTransaction: state.send, getTransaction: state.read },
    { hash: () => Buffer.from(state.localHash, "hex") } as Transaction
  );

  // Model a blocked caller before the queued RPC microtask gets to run.
  monotonicNow = 30_000;
  await expect(pending).rejects.toMatchObject({
    name: "FaucetMintPendingError",
    hash: state.localHash,
  });
  expect(state.send).not.toHaveBeenCalled();
  expect(state.read).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

describe.each(["bulk", "legacy"])("%s mint cooldown", (mode) => {
  beforeEach(() => {
    state.contractId = mode === "bulk" ? "bulk-faucet" : undefined;
  });

  it.each([
    "status-read failure",
    "lost submission reply",
    "confirmation timeout",
  ])("keeps the owned cooldown after %s", async (failure) => {
    if (failure === "status-read failure") {
      state.read.mockRejectedValue(new Error("RPC unavailable"));
    }
    if (failure === "lost submission reply") {
      state.send.mockRejectedValue(new Error("connection reset"));
    }
    if (failure === "confirmation timeout") {
      state.read.mockResolvedValue({ status: "NOT_FOUND" });
    }

    const pending = POST(request());
    await vi.runAllTimersAsync();
    const response = await pending;
    const nextResponse = await POST(request());
    expect([
      response.status,
      nextResponse.status,
      state.send.mock.calls.length,
    ]).toEqual([202, 429, 1]);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, pending: true });
    const item = mode === "bulk" ? body : body.results[0];
    expect(item.hash).toBe(
      failure === "lost submission reply" ? state.localHash : state.remoteHash
    );
    expect(item.success).toBe(false);
  });

  it.each(["stalled send", "stalled status read", "slow status reads"])(
    "returns pending within the overall deadline after %s",
    async (failure) => {
      let settleLate: (() => void) | undefined;
      if (failure === "stalled send") {
        state.send.mockImplementation(
          () =>
            new Promise((resolve) => {
              settleLate = () =>
                resolve({ status: "PENDING", hash: state.remoteHash });
            })
        );
      } else if (failure === "stalled status read") {
        state.read.mockImplementation(
          () =>
            new Promise((_, reject) => {
              settleLate = () => reject(new Error("late RPC failure"));
            })
        );
      } else {
        state.read.mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ status: "NOT_FOUND" }), 10_000)
            )
        );
      }

      let settled = false;
      const started = performance.now();
      const pending = POST(request()).then((response) => {
        settled = true;
        return response;
      });
      await vi.advanceTimersByTimeAsync(29_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(performance.now() - started).toBe(30_000);
      expect(response.status).toBe(202);
      const body = await response.json();
      expect(body).toMatchObject({ success: false, pending: true });
      const item = mode === "bulk" ? body : body.results[0];
      expect(item.hash).toBe(
        failure === "stalled send" ? state.localHash : state.remoteHash
      );
      expect((await POST(request())).status).toBe(429);
      expect(state.send).toHaveBeenCalledTimes(1);
      const readsAtDeadline = state.read.mock.calls.length;
      expect(readsAtDeadline).toBe(
        failure === "stalled send" ? 0 : failure === "stalled status read" ? 1 : 3
      );

      // Late acknowledgements/errors/results are consumed without a second
      // submission or restarting the confirmation loop after HTTP 202.
      settleLate?.();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(state.send).toHaveBeenCalledTimes(1);
      expect(state.read).toHaveBeenCalledTimes(readsAtDeadline);
      expect(vi.getTimerCount()).toBe(0);
    }
  );

  it.each(["ERROR", "TRY_AGAIN_LATER", "FAILED"])(
    "releases after definitive %s",
    async (status) => {
      if (status !== "FAILED") {
        state.send.mockResolvedValue({ status, hash: state.remoteHash });
      } else {
        state.read.mockResolvedValue({ status });
      }
      expect((await POST(request())).status).toBe(500);
      expect((await POST(request())).status).toBe(500);
      expect(state.send).toHaveBeenCalledTimes(2);
    }
  );

  it("keeps the cooldown after confirmed success", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
    expect((await POST(request())).status).toBe(429);
    expect(state.send).toHaveBeenCalledTimes(1);
  });

  it("checks a duplicate submission's outcome", async () => {
    state.send.mockResolvedValue({
      status: "DUPLICATE",
      hash: state.remoteHash,
    });
    state.read.mockRejectedValue(new Error("RPC unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      success: false,
      pending: true,
    });
    expect(state.read).toHaveBeenCalledWith(state.remoteHash);
    expect((await POST(request())).status).toBe(429);
  });
});

it("retains a legacy partial outcome with an unresolved token", async () => {
  state.contractId = undefined;
  state.tokens.push({ symbol: "SECOND", contractId: "second", mintAmount: 2n });
  state.read
    .mockResolvedValueOnce({ status: "SUCCESS" })
    .mockRejectedValue(new Error("RPC unavailable"));
  const response = await POST(request());
  expect(response.status).toBe(202);
  const body = await response.json();
  expect(body.results[0]).toMatchObject({ success: true });
  expect(body.results[1]).toMatchObject({ success: false, pending: true });
  expect((await POST(request())).status).toBe(429);
  expect(state.send).toHaveBeenCalledTimes(2);
});
