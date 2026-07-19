/**
 * Tests for BlendPoolAdapter — the orchestrator adapter that turns pool actions
 * into Blend `submit` / `claim` operations and wraps them into a prepared,
 * signable Stellar transaction (issue #255).
 *
 * The Blend SDK and the whole @stellar/stellar-sdk transaction pipeline are
 * mocked so the suite exercises the adapter's own transformation logic:
 * raw-id parsing, the action → RequestType mapping, the exact request payload
 * handed to the tx-builders, reward-claim id selection, and the pure
 * amount-formatting used when reading a user position. No network runs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  poolLoadMock,
  tokenMetaLoadMock,
  submitMock,
  claimMock,
  PoolContractV2Mock,
  fromXDRMock,
  loadAccountMock,
  prepareTransactionMock,
  builder,
} = vi.hoisted(() => {
  const submitMock = vi.fn(() => "OP_XDR");
  const claimMock = vi.fn(() => "CLAIM_XDR");
  const builder = {
    addOperation: vi.fn(() => builder),
    setTimeout: vi.fn(() => builder),
    build: vi.fn(() => ({ __tx: true })),
  };
  return {
    poolLoadMock: vi.fn(),
    tokenMetaLoadMock: vi.fn(),
    submitMock,
    claimMock,
    PoolContractV2Mock: vi.fn(function () {
      return { submit: submitMock, claim: claimMock };
    }),
    fromXDRMock: vi.fn(() => ({ __op: true })),
    loadAccountMock: vi.fn(async () => ({ __account: true })),
    prepareTransactionMock: vi.fn(async () => ({
      toXDR: () => "PREPARED_XDR",
    })),
    builder,
  };
});

vi.mock("@blend-capital/blend-sdk", () => ({
  RequestType: {
    SupplyCollateral: 0,
    WithdrawCollateral: 1,
    Supply: 2,
    Withdraw: 3,
    Borrow: 4,
    Repay: 5,
  },
  PoolV2: { load: poolLoadMock },
  PoolContractV2: PoolContractV2Mock,
  TokenMetadata: { load: tokenMetaLoadMock },
}));

vi.mock("@stellar/stellar-sdk", () => ({
  xdr: { Operation: { fromXDR: fromXDRMock } },
  Horizon: {
    Server: vi.fn(function () {
      return { loadAccount: loadAccountMock };
    }),
  },
  TransactionBuilder: vi.fn(function () {
    return builder;
  }),
  rpc: {
    Server: vi.fn(function () {
      return { prepareTransaction: prepareTransactionMock };
    }),
  },
}));

import { BlendPoolAdapter } from "../BlendPoolAdapter";
import { RequestType } from "@blend-capital/blend-sdk";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { networkPassphrase } from "@/lib/constants/network";
import { AdapterError, UnsupportedActionError } from "../../types/errors";

const POOL = "CPOOL";
const ASSET = "CASSET";
const RAW = `${POOL}:${ASSET}`;
const USER = "GUSER";

beforeEach(() => {
  vi.clearAllMocks();
  submitMock.mockReturnValue("OP_XDR");
  claimMock.mockReturnValue("CLAIM_XDR");
});

describe("BlendPoolAdapter – raw id parsing / guards", () => {
  it("rejects a raw id without a colon separator", async () => {
    const adapter = new BlendPoolAdapter(POOL);
    await expect(adapter.deposit("no-colon", USER, 1n)).rejects.toBeInstanceOf(
      AdapterError
    );
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("reports supported actions", () => {
    const adapter = new BlendPoolAdapter(POOL);
    expect(adapter.supportsAction("deposit")).toBe(true);
    expect(adapter.supportsAction("flashLoan" as never)).toBe(false);
  });
});

describe("BlendPoolAdapter – buildSubmitTx fund-moving flow", () => {
  it("builds a deposit submit request and returns the prepared xdr", async () => {
    const adapter = new BlendPoolAdapter(POOL);
    const result = await adapter.deposit(RAW, USER, 1_000_0000n);

    expect(PoolContractV2Mock).toHaveBeenCalledWith(POOL);
    expect(submitMock).toHaveBeenCalledWith({
      from: USER,
      spender: USER,
      to: USER,
      requests: [
        {
          request_type: RequestType.Supply,
          address: ASSET,
          amount: 1_000_0000n,
        },
      ],
    });
    // op xdr from submit is decoded and threaded through the tx pipeline
    expect(fromXDRMock).toHaveBeenCalledWith("OP_XDR", "base64");
    expect(loadAccountMock).toHaveBeenCalledWith(USER);
    expect(TransactionBuilder).toHaveBeenCalledWith(
      { __account: true },
      { fee: "100", networkPassphrase }
    );
    expect(builder.setTimeout).toHaveBeenCalledWith(300);
    expect(prepareTransactionMock).toHaveBeenCalled();
    expect(result).toEqual({ xdr: "PREPARED_XDR", networkPassphrase });
  });

  it("maps each action to the correct RequestType with the raw amount", async () => {
    const adapter = new BlendPoolAdapter(POOL);
    const cases: Array<[keyof BlendPoolAdapter, number]> = [
      ["withdraw", RequestType.Withdraw],
      ["borrow", RequestType.Borrow],
      ["repay", RequestType.Repay],
      ["supplyCollateral", RequestType.SupplyCollateral],
      ["withdrawCollateral", RequestType.WithdrawCollateral],
    ];

    for (const [method, requestType] of cases) {
      submitMock.mockClear();
      await (
        adapter[method] as (
          poolId: string,
          user: string,
          amount: bigint
        ) => Promise<unknown>
      )(RAW, USER, 42n);
      expect(submitMock).toHaveBeenCalledWith(
        expect.objectContaining({
          requests: [
            { request_type: requestType, address: ASSET, amount: 42n },
          ],
        })
      );
    }
  });

  it("wraps tx-builder failures in an AdapterError", async () => {
    submitMock.mockImplementationOnce(() => {
      throw new Error("submit blew up");
    });
    const adapter = new BlendPoolAdapter(POOL);
    await expect(adapter.borrow(RAW, USER, 5n)).rejects.toBeInstanceOf(
      AdapterError
    );
  });
});

describe("BlendPoolAdapter – claimRewards", () => {
  it("claims supply and borrow emission token ids", async () => {
    const reserve = {
      supplyEmissions: true,
      borrowEmissions: true,
      getBTokenEmissionIndex: () => 0,
      getDTokenEmissionIndex: () => 1,
    };
    poolLoadMock.mockResolvedValue({ reserves: new Map([[ASSET, reserve]]) });

    const adapter = new BlendPoolAdapter(POOL);
    const result = await adapter.claimRewards(RAW, USER);

    expect(claimMock).toHaveBeenCalledWith({
      from: USER,
      reserve_token_ids: [0, 1],
      to: USER,
    });
    expect(result).toEqual({ xdr: "PREPARED_XDR", networkPassphrase });
  });

  it("throws UnsupportedActionError when the reserve has no emissions", async () => {
    const reserve = { supplyEmissions: false, borrowEmissions: false };
    poolLoadMock.mockResolvedValue({ reserves: new Map([[ASSET, reserve]]) });

    const adapter = new BlendPoolAdapter(POOL);
    await expect(adapter.claimRewards(RAW, USER)).rejects.toBeInstanceOf(
      UnsupportedActionError
    );
    expect(claimMock).not.toHaveBeenCalled();
  });

  it("throws AdapterError when the reserve is missing", async () => {
    poolLoadMock.mockResolvedValue({ reserves: new Map() });
    const adapter = new BlendPoolAdapter(POOL);
    await expect(adapter.claimRewards(RAW, USER)).rejects.toBeInstanceOf(
      AdapterError
    );
  });
});

describe("BlendPoolAdapter – getUserPosition amount formatting", () => {
  it("sums supply + collateral and formats by reserve decimals", async () => {
    const reserve = { config: { decimals: 7 } };
    const poolUser = {
      getSupply: () => 5_000_000n,
      getCollateral: () => 2_000_000n,
      getLiabilities: () => 0n,
      estimateEmissions: () => ({ claimedTokens: 3n }),
    };
    poolLoadMock.mockResolvedValue({
      reserves: new Map([[ASSET, reserve]]),
      loadUser: async () => poolUser,
    });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.poolId).toBe(`blend:${POOL}:${ASSET}`);
    expect(pos.deposited).toBe(7_000_000n);
    expect(pos.depositedFormatted).toBe("0.7");
    expect(pos.metadata).toMatchObject({
      supplied: "5000000",
      collateral: "2000000",
      liabilities: "0",
    });
  });

  it("returns an empty position when the reserve is not found", async () => {
    poolLoadMock.mockResolvedValue({ reserves: new Map() });
    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos).toEqual({
      poolId: `blend:${POOL}:${ASSET}`,
      deposited: 0n,
      depositedFormatted: "0",
      rewards: 0n,
      rewardsFormatted: "0",
      metadata: {},
    });
  });
});
