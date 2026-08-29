import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  // Reusable tx stub returned by all Stellar SDK builder/prepare calls
  const signedTx = {
    toXDR: () => "AAAAAA==",
    sign: vi.fn(),
  };

  // Chainable TransactionBuilder stub
  const builder = {
    addOperation: vi.fn().mockReturnThis(),
    setTimeout: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(signedTx),
  };

  return {
    // KV store
    mockAcquire: vi.fn().mockResolvedValue(true),
    mockRelease: vi.fn().mockResolvedValue(undefined),
    mockTtl: vi.fn().mockResolvedValue(0),
    // env
    mockRequireServerEnv: vi.fn(() => ({
      VAULT_MANAGER_SECRET_KEY: "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    })),
    // Stellar rpc.Server methods
    mockGetAccount: vi.fn().mockResolvedValue({}),
    mockPrepareTransaction: vi.fn().mockResolvedValue(signedTx),
    mockSendTransaction: vi.fn().mockResolvedValue({ status: "PENDING", hash: "abc123" }),
    mockGetTransaction: vi.fn().mockResolvedValue({ status: "SUCCESS" }),
    // TransactionBuilder stub
    builder,
    signedTx,
    // DefindexVaultClient methods
    mockFetchTotalManagedFunds: vi.fn().mockResolvedValue({
      result: {
        tag: "ok",
        value: [{
          idle_amount: { toString: () => "0" },
          total_amount: { toString: () => "0" },
          strategy_allocations: [],
        }],
      },
    }),
    mockRebalance: vi.fn().mockResolvedValue({ toXDR: () => "AAAAAA==", simulation: {}, sign: vi.fn() }),
    mockReport: vi.fn().mockResolvedValue({ toXDR: () => "AAAAAA==", simulation: {}, sign: vi.fn() }),
    mockLockFees: vi.fn().mockResolvedValue({ toXDR: () => "AAAAAA==", simulation: {}, sign: vi.fn() }),
    mockDistributeFees: vi.fn().mockResolvedValue({ toXDR: () => "AAAAAA==", simulation: {}, sign: vi.fn() }),
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/env.server", () => ({
  serverEnv: {
    CRON_SECRET: "test-secret-that-is-32-chars-long!!",
    VAULT_MANAGER_PUBLIC_KEY: undefined,
  },
  requireServerEnv: mocks.mockRequireServerEnv,
}));

vi.mock("@/lib/rateLimit/store", () => ({
  acquireInvestLock: mocks.mockAcquire,
  releaseInvestLock: mocks.mockRelease,
  getInvestLockTtl: mocks.mockTtl,
}));

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();

  // TransactionBuilder must be a real constructor (new TransactionBuilder(...))
  function MockTransactionBuilder() {
    return mocks.builder;
  }
  MockTransactionBuilder.fromXDR = vi.fn(() => mocks.signedTx);

  return {
    ...actual,
    Keypair: {
      fromSecret: vi.fn(() => ({ publicKey: () => "GPUBKEY", sign: vi.fn() })),
    },
    TransactionBuilder: MockTransactionBuilder,
    rpc: {
      // Regular function required so `new rpc.Server()` works
      Server: vi.fn(function () {
        return {
          getAccount: mocks.mockGetAccount,
          prepareTransaction: mocks.mockPrepareTransaction,
          sendTransaction: mocks.mockSendTransaction,
          getTransaction: mocks.mockGetTransaction,
        };
      }),
    },
  };
});

vi.mock("@neko/defindex-vault", () => ({
  // Regular function required so `new Client(...)` works
  Client: vi.fn(function () {
    return {
      fetch_total_managed_funds: mocks.mockFetchTotalManagedFunds,
      rebalance: mocks.mockRebalance,
      report: mocks.mockReport,
      lock_fees: mocks.mockLockFees,
      distribute_fees: mocks.mockDistributeFees,
    };
  }),
}));

vi.mock("@/lib/env.client", () => ({
  clientEnv: {
    rpcUrl: "https://soroban-testnet.stellar.org",
    networkPassphrase: "Test SDF Network ; September 2015",
  },
}));

// ── Subject ───────────────────────────────────────────────────────────────────

import { POST } from "../route";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_SECRET = "test-secret-that-is-32-chars-long!!";

function makePost(authHeader?: string): NextRequest {
  return new NextRequest("http://localhost/api/vault/invest", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

function resetMocks() {
  vi.clearAllMocks();
  mocks.mockAcquire.mockResolvedValue(true);
  mocks.mockRelease.mockResolvedValue(undefined);
  mocks.mockRequireServerEnv.mockReturnValue({
    VAULT_MANAGER_SECRET_KEY: "SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  });
  mocks.mockSendTransaction.mockResolvedValue({ status: "PENDING", hash: "abc123" });
  mocks.mockGetTransaction.mockResolvedValue({ status: "SUCCESS" });
  mocks.mockPrepareTransaction.mockResolvedValue(mocks.signedTx);
  mocks.mockFetchTotalManagedFunds.mockResolvedValue({
    result: {
      tag: "ok",
      value: [{
        idle_amount: { toString: () => "0" },
        total_amount: { toString: () => "0" },
        strategy_allocations: [],
      }],
    },
  });
  const txStub = { toXDR: () => "AAAAAA==", simulation: {}, sign: vi.fn() };
  mocks.mockReport.mockResolvedValue(txStub);
  mocks.mockLockFees.mockResolvedValue(txStub);
  mocks.mockDistributeFees.mockResolvedValue(txStub);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/vault/invest — authentication gate", () => {
  beforeEach(resetMocks);

  it("returns 401 when Authorization header is missing", async () => {
    const res = await POST(makePost());
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 for a wrong Bearer token", async () => {
    const res = await POST(makePost("Bearer wrong-token"));
    expect(res.status).toBe(401);
  });

  it("returns 401 when x-vercel-cron header is set but no valid secret (spoofed cron)", async () => {
    const req = new NextRequest("http://localhost/api/vault/invest", {
      method: "POST",
      headers: { "x-vercel-cron": "1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 for Basic auth scheme", async () => {
    const res = await POST(makePost("Basic dXNlcjpwYXNz"));
    expect(res.status).toBe(401);
  });

  it("returns 401 for a wrong secret of the same length as the correct one", async () => {
    // Same byte-length as VALID_SECRET — timing-safe compare must still reject
    const sameLength = VALID_SECRET.slice(0, -1) + "X";
    const res = await POST(makePost(`Bearer ${sameLength}`));
    expect(res.status).toBe(401);
  });
});

describe("POST /api/vault/invest — concurrency lock (409 per acceptance criteria)", () => {
  beforeEach(resetMocks);

  it("returns 409 when the invest lock is already held", async () => {
    mocks.mockAcquire.mockResolvedValueOnce(false);
    const res = await POST(makePost(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("already running");
  });

  it("releases the lock even when the job throws", async () => {
    mocks.mockRequireServerEnv.mockImplementationOnce(() => {
      throw new Error("simulated crash");
    });
    const res = await POST(makePost(`Bearer ${VALID_SECRET}`));
    expect(res.status).toBe(500);
    expect(mocks.mockRelease).toHaveBeenCalledOnce();
  });
});

describe("POST /api/vault/invest — valid secret → 200", () => {
  // waitForTx uses setTimeout(2000) per iteration — use fake timers to avoid
  // real delays, and advance time so the await resolves immediately.
  beforeEach(() => {
    vi.useFakeTimers();
    resetMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 200 when authorized and vault has no idle funds to invest", async () => {
    // idle_amount = 0 → investIdle short-circuits, collectFees runs (report+lock+distribute)
    const promise = POST(makePost(`Bearer ${VALID_SECRET}`));
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("harvest");
    expect(body).toHaveProperty("invest");
    expect(body).toHaveProperty("fees");
    expect(body.success).toBe(true);
  });

  it("acquires and releases the lock on a successful run", async () => {
    const promise = POST(makePost(`Bearer ${VALID_SECRET}`));
    await vi.runAllTimersAsync();
    await promise;
    expect(mocks.mockAcquire).toHaveBeenCalledOnce();
    expect(mocks.mockRelease).toHaveBeenCalledOnce();
  });

  it("does not acquire lock or submit any transactions when auth fails", async () => {
    await POST(makePost("Bearer wrong"));
    expect(mocks.mockAcquire).not.toHaveBeenCalled();
    expect(mocks.mockSendTransaction).not.toHaveBeenCalled();
  });
});

describe("POST /api/vault/invest — response body sanitization", () => {
  beforeEach(resetMocks);

  it("does not expose raw error messages in the response body on internal error", async () => {
    mocks.mockRequireServerEnv.mockImplementationOnce(() => {
      throw new Error("VAULT_MANAGER_SECRET_KEY leaked in error");
    });
    const res = await POST(makePost(`Bearer ${VALID_SECRET}`));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("VAULT_MANAGER_SECRET_KEY");
    expect(body).toEqual({ error: "Internal server error" });
  });
});
