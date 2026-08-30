import { describe, it, expect, vi, beforeEach } from "vitest";

const { withdrawMock, depositMock, getQuoteMock, buildTransactionMock } =
  vi.hoisted(() => ({
    withdrawMock: vi.fn(),
    depositMock: vi.fn(),
    getQuoteMock: vi.fn(),
    buildTransactionMock: vi.fn(),
  }));

vi.mock("@/lib/orchestrator", () => ({
  orchestrator: { withdraw: withdrawMock, deposit: depositMock },
}));

vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getQuote: getQuoteMock,
  buildTransaction: buildTransactionMock,
}));

import {
  withdrawExecutor,
  depositExecutor,
  swapExecutor,
} from "../stepExecutors";
import type { JobRun, JobStep } from "@/lib/jobs/types";

const WALLET = "G".padEnd(56, "A");

function makeJob(overrides: Partial<JobRun> = {}): JobRun {
  return {
    id: "job-1",
    jobType: "automation-rebalance",
    externalRef: "plan-1",
    walletAddress: WALLET,
    status: "running",
    payload: {},
    leaseOwner: "worker-a",
    leaseExpiresAt: null,
    error: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function makeStep(overrides: Partial<JobStep> = {}): JobStep {
  return {
    id: "step-1",
    jobId: "job-1",
    index: 0,
    kind: "withdraw",
    input: {},
    status: "running",
    result: null,
    startedAt: Date.now(),
    completedAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withdrawExecutor / depositExecutor", () => {
  it("converts amountUsd to stroops and calls the orchestrator with the wallet address", async () => {
    withdrawMock.mockResolvedValue({ xdr: "XDR1", networkPassphrase: "Test" });
    const job = makeJob();
    const step = makeStep({
      input: { venueId: "blend:pool:asset", amountUsd: 12.5 },
    });

    const result = await withdrawExecutor({ job, step });

    expect(withdrawMock).toHaveBeenCalledWith(
      "blend:pool:asset",
      WALLET,
      125_000_000n
    );
    expect(result).toEqual({ xdr: "XDR1", networkPassphrase: "Test" });
  });

  it("throws if the run has no owning wallet address", async () => {
    const job = makeJob({ walletAddress: null });
    const step = makeStep({ input: { venueId: "neko:USDC", amountUsd: 10 } });
    await expect(depositExecutor({ job, step })).rejects.toThrow(/wallet/i);
    expect(depositMock).not.toHaveBeenCalled();
  });
});

describe("swapExecutor", () => {
  it("quotes and builds a swap using the venueId's asset pair", async () => {
    getQuoteMock.mockResolvedValue({ amountOut: "1", amountIn: "1" });
    buildTransactionMock.mockResolvedValue({ xdr: "SWAP_XDR" });

    const job = makeJob();
    const step = makeStep({
      kind: "swap",
      input: { venueId: "USDC-XLM", asset: "USDC", amountUsd: 20 },
    });

    const result = await swapExecutor({ job, step });

    expect(getQuoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assetIn: "USDC",
        assetOut: "XLM",
        tradeType: "EXACT_IN",
      })
    );
    expect(buildTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: WALLET })
    );
    expect(result).toEqual({ xdr: "SWAP_XDR" });
  });

  it("throws when no quote is available", async () => {
    getQuoteMock.mockResolvedValue(undefined);
    const job = makeJob();
    const step = makeStep({
      kind: "swap",
      input: { venueId: "USDC-XLM", asset: "USDC", amountUsd: 20 },
    });

    await expect(swapExecutor({ job, step })).rejects.toThrow(/quote/i);
    expect(buildTransactionMock).not.toHaveBeenCalled();
  });
});
