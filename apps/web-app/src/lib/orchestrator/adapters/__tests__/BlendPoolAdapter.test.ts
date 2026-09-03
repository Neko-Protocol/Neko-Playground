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
  positionsEstimateBuildMock,
  fromXDRMock,
  loadAccountMock,
  prepareTransactionMock,
  builder,
} = vi.hoisted(() => {
  const submitMock = vi.fn(() => "OP_XDR");
  const claimMock = vi.fn(() => "CLAIM_XDR");
  const positionsEstimateBuildMock = vi.fn();
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
    positionsEstimateBuildMock,
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
  PositionsEstimate: { build: positionsEstimateBuildMock },
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

/**
 * Reserve stub with plausible Blend values: 7 decimals, 1 000 units supplied,
 * nothing borrowed, 95% max utilization, c_factor 0.9 and l_factor 0.8
 * (`getLiabilityFactor` returns the 1/l_factor multiplier the SDK exposes).
 */
function makeReserve(overrides: Record<string, unknown> = {}) {
  return {
    assetId: ASSET,
    config: { decimals: 7, max_util: 9_500_000 },
    totalSupply: () => 10_000_000_000n,
    totalLiabilities: () => 0n,
    getCollateralFactor: () => 0.9,
    getLiabilityFactor: () => 1 / 0.8,
    ...overrides,
  };
}

function makePoolUser(overrides: Record<string, unknown> = {}) {
  return {
    positions: {
      supply: new Map(),
      collateral: new Map(),
      liabilities: new Map(),
    },
    getSupply: () => 5_000_000n,
    getCollateral: () => 2_000_000n,
    getLiabilities: () => 0n,
    estimateEmissions: () => ({ claimedTokens: 3n }),
    ...overrides,
  };
}

/**
 * @param oracle - `null` makes `loadOracle` reject, standing in for a price
 *   feed outage.
 */
function mockPool({
  reserve = makeReserve(),
  poolUser = makePoolUser(),
  price = 1,
  borrowCap = 1_000,
  oracle = {} as Record<string, unknown> | null,
}: {
  reserve?: Record<string, unknown>;
  poolUser?: Record<string, unknown>;
  price?: number | undefined;
  borrowCap?: number;
  oracle?: Record<string, unknown> | null;
} = {}) {
  positionsEstimateBuildMock.mockReturnValue({ borrowCap });
  poolLoadMock.mockResolvedValue({
    reserves: new Map([[ASSET, reserve]]),
    loadUser: async () => poolUser,
    loadOracle: async () =>
      oracle === null
        ? Promise.reject(new Error("oracle unavailable"))
        : { getPriceFloat: () => price, ...oracle },
  });
}

describe("BlendPoolAdapter – getUserPosition amount formatting", () => {
  it("exposes supply, collateral and liabilities as separate balances", async () => {
    mockPool({
      poolUser: makePoolUser({
        getSupply: () => 5_000_000n,
        getCollateral: () => 2_000_000n,
        getLiabilities: () => 1_000_000n,
      }),
    });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.poolId).toBe(`blend:${POOL}:${ASSET}`);
    expect(pos.supplied).toBe(5_000_000n);
    expect(pos.suppliedFormatted).toBe("0.5");
    expect(pos.collateral).toBe(2_000_000n);
    expect(pos.collateralFormatted).toBe("0.2");
    expect(pos.liabilities).toBe(1_000_000n);
    expect(pos.liabilitiesFormatted).toBe("0.1");
  });

  it("keeps deposited as the display-only sum of both supply buckets", async () => {
    mockPool();

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

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
      supplied: 0n,
      suppliedFormatted: "0",
      collateral: 0n,
      collateralFormatted: "0",
      liabilities: 0n,
      liabilitiesFormatted: "0",
      rewards: 0n,
      rewardsFormatted: "0",
      limits: {},
      metadata: {},
    });
  });
});

describe("BlendPoolAdapter – getUserPosition action limits", () => {
  it("caps withdraw at the supply bucket and withdrawCollateral at the collateral bucket", async () => {
    // The regression from issue #296: a user with both balances used to be
    // offered their sum for either action.
    mockPool();

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.withdraw).toBe(5_000_000n);
    expect(pos.limits.withdrawCollateral).toBe(2_000_000n);
    expect(pos.limits.withdraw).not.toBe(pos.deposited);
    expect(pos.limits.withdrawCollateral).not.toBe(pos.deposited);
  });

  it("caps repay at the outstanding liabilities", async () => {
    mockPool({
      poolUser: makePoolUser({ getLiabilities: () => 3_300_000n }),
    });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.repay).toBe(3_300_000n);
  });

  it("derives a borrow limit from headroom, price and the liability factor", async () => {
    // 1000 of headroom at a price of 2 with an l_factor of 0.8 leaves
    // 1000 * 0.995 / (2 * 1.25) = 398 assets = 3_980_000_000 units.
    mockPool({ price: 2, borrowCap: 1_000 });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.borrow).toBe(3_980_000_000n);
  });

  it("caps borrow at the reserve's max-utilization liquidity", async () => {
    // 95% of a 1 000-unit supply, minus 900 already borrowed, leaves 50 units —
    // below the capacity the user's collateral would otherwise allow.
    mockPool({
      reserve: makeReserve({ totalLiabilities: () => 9_000_000_000n }),
      borrowCap: 1_000_000,
    });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.borrow).toBe(500_000_000n);
  });

  it("caps withdraw at the cash actually left in the reserve", async () => {
    mockPool({
      reserve: makeReserve({ totalLiabilities: () => 9_000_000_000n }),
      poolUser: makePoolUser({ getSupply: () => 5_000_000_000n }),
    });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.withdraw).toBe(1_000_000_000n);
  });

  it("bounds collateral withdrawal by the headroom it would consume", async () => {
    // 10 of headroom at price 1 with a 0.9 collateral factor releases
    // 10 * 0.995 / 0.9 = 11.055... assets, under the 20-unit balance.
    mockPool({
      poolUser: makePoolUser({ getCollateral: () => 200_000_000n }),
      price: 1,
      borrowCap: 10,
    });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.withdrawCollateral).toBe(110_555_555n);
  });

  it("offers no borrow or collateral withdrawal to an underwater position", async () => {
    mockPool({ borrowCap: -50 });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.borrow).toBe(0n);
    expect(pos.limits.withdrawCollateral).toBe(0n);
    // The supply bucket carries no collateral factor, so it stays withdrawable.
    expect(pos.limits.withdraw).toBe(5_000_000n);
  });

  it("keeps the bucket split when the oracle is unavailable", async () => {
    mockPool({ oracle: null });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.withdraw).toBe(5_000_000n);
    expect(pos.limits.withdrawCollateral).toBe(2_000_000n);
    // Falls back to the liquidity ceiling rather than removing the cap.
    expect(pos.limits.borrow).toBe(9_500_000_000n);
  });

  it("falls back to the liquidity ceiling when the asset has no price", async () => {
    mockPool({ oracle: { getPriceFloat: () => undefined } });

    const adapter = new BlendPoolAdapter(POOL);
    const pos = await adapter.getUserPosition(RAW, USER);

    expect(pos.limits.borrow).toBe(9_500_000_000n);
    expect(pos.limits.withdrawCollateral).toBe(2_000_000n);
  });
});
