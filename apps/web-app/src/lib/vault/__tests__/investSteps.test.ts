/**
 * `investSteps.ts` is a verbatim extraction of the sequence that used to
 * live inline in `app/api/vault/invest/route.ts` — these tests cover the
 * pure branching logic (thresholds, early-return on a failed sub-step)
 * rather than re-deriving Stellar SDK behavior, matching how
 * `BlendPoolAdapter.test.ts` mocks the SDK boundary.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env.client", () => ({
  clientEnv: {
    stellarNetwork: "TESTNET",
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "http://rpc.local",
    horizonUrl: "http://horizon.local",
  },
}));

const {
  fromXDRMock,
  prepareTransactionMock,
  sendTransactionMock,
  getTransactionMock,
} = vi.hoisted(() => ({
  fromXDRMock: vi.fn((xdr: string) => ({ __tx: xdr })),
  prepareTransactionMock: vi.fn(async () => ({ sign: vi.fn() })),
  sendTransactionMock: vi.fn(async () => ({
    status: "PENDING",
    hash: "HASH1",
  })),
  getTransactionMock: vi.fn(async () => ({ status: "SUCCESS" })),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Keypair: { fromSecret: vi.fn() },
  TransactionBuilder: Object.assign(
    vi.fn(function (this: unknown) {
      return {
        addOperation: vi.fn().mockReturnThis(),
        setTimeout: vi.fn().mockReturnThis(),
        build: vi.fn(() => ({ __built: true })),
      };
    }),
    { fromXDR: fromXDRMock }
  ),
  rpc: { Server: vi.fn() },
  BASE_FEE: "100",
  Operation: { invokeContractFunction: vi.fn(() => ({ __op: true })) },
  Address: vi.fn(function () {
    return { toScVal: () => ({ __scval: true }) };
  }),
  xdr: { ScVal: { scvVoid: () => ({ __void: true }) } },
}));

import {
  sendTx,
  investIdle,
  collectFees,
  MIN_IDLE_THRESHOLD,
} from "../investSteps";

function fakeServer() {
  return {
    prepareTransaction: prepareTransactionMock,
    sendTransaction: sendTransactionMock,
    getTransaction: getTransactionMock,
    getAccount: vi.fn(async () => ({ __account: true })),
  } as unknown as import("@stellar/stellar-sdk").rpc.Server;
}

const keypair = {
  sign: vi.fn(),
  publicKey: () => "GMANAGER",
} as unknown as import("@stellar/stellar-sdk").Keypair;

beforeEach(() => {
  vi.clearAllMocks();
  sendTransactionMock.mockResolvedValue({ status: "PENDING", hash: "HASH1" });
  getTransactionMock.mockResolvedValue({ status: "SUCCESS" });
});

describe("sendTx", () => {
  it("returns a sim_error result without submitting when simulation failed", async () => {
    const assembledTx = {
      simulation: { error: "boom" },
      toXDR: () => "XDR",
    } as unknown as Parameters<typeof sendTx>[0];

    const result = await sendTx(assembledTx, keypair, fakeServer(), "Test");

    expect(result.status).toBe("sim_error: boom");
    expect(sendTransactionMock).not.toHaveBeenCalled();
  });

  it("submits and waits for the transaction to succeed", async () => {
    const assembledTx = {
      simulation: {},
      toXDR: () => "XDR",
    } as unknown as Parameters<typeof sendTx>[0];

    const result = await sendTx(assembledTx, keypair, fakeServer(), "Test");

    expect(sendTransactionMock).toHaveBeenCalled();
    expect(result).toEqual({ hash: "HASH1", status: "SUCCESS" });
  });
});

describe("investIdle", () => {
  it("does nothing when idle funds are below the minimum threshold", async () => {
    const client = {
      fetch_total_managed_funds: vi.fn(async () => ({
        result: [{ idle_amount: MIN_IDLE_THRESHOLD - 1n, total_amount: 0n }],
      })),
    } as unknown as Parameters<typeof investIdle>[0];

    const result = await investIdle(client, keypair, fakeServer(), "Test");
    expect(result.invested).toBe(false);
    expect(result.results).toEqual([]);
  });

  it("splits idle funds across every strategy when above threshold", async () => {
    // 3 sequential sendTx calls, each with a real 2s waitForTx poll.
    const rebalanceMock = vi.fn(async () => ({
      simulation: {},
      toXDR: () => "XDR",
    }));
    const client = {
      fetch_total_managed_funds: vi.fn(async () => ({
        result: [{ idle_amount: MIN_IDLE_THRESHOLD * 3n, total_amount: 0n }],
      })),
      rebalance: rebalanceMock,
    } as unknown as Parameters<typeof investIdle>[0];

    const result = await investIdle(client, keypair, fakeServer(), "Test");
    expect(result.invested).toBe(true);
    expect(rebalanceMock).toHaveBeenCalledTimes(3);
    expect(result.results).toHaveLength(3);
  }, 15_000);
});

describe("collectFees", () => {
  it("stops after report() fails without calling lock_fees or distribute_fees", async () => {
    // A simulation error short-circuits sendTx before it ever polls for a
    // transaction result, so this stays fast and avoids the real-timer
    // waitForTx poll entirely.
    const lockFees = vi.fn();
    const distributeFees = vi.fn();
    const client = {
      report: vi.fn(async () => ({
        simulation: { error: "boom" },
        toXDR: () => "XDR",
      })),
      lock_fees: lockFees,
      distribute_fees: distributeFees,
    } as unknown as Parameters<typeof collectFees>[0];

    const result = await collectFees(client, keypair, fakeServer(), "Test");

    expect(result.feesCollected).toBe(false);
    expect(lockFees).not.toHaveBeenCalled();
    expect(distributeFees).not.toHaveBeenCalled();
  });

  it("collects fees end-to-end when every stage succeeds", async () => {
    const client = {
      report: vi.fn(async () => ({ simulation: {}, toXDR: () => "XDR" })),
      lock_fees: vi.fn(async () => ({ simulation: {}, toXDR: () => "XDR" })),
      distribute_fees: vi.fn(async () => ({
        simulation: {},
        toXDR: () => "XDR",
      })),
    } as unknown as Parameters<typeof collectFees>[0];

    const result = await collectFees(client, keypair, fakeServer(), "Test");
    expect(result.feesCollected).toBe(true);
    expect(result.results.map((r) => r.step)).toEqual([
      "report",
      "lock_fees",
      "distribute_fees",
    ]);
  }, 15_000);
});
