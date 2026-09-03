/**
 * Tests for NekoLendingAdapter — the orchestrator adapter that turns pool
 * actions into Soroban lending transactions (issue #255).
 *
 * The @neko/lending contract client, the soroswap token registry and the
 * deposit/withdraw tx builders are all mocked so the tests exercise the
 * adapter's own logic: pool-contract selection, smallest-unit → human amount
 * conversion, PoolInfo/PoolPosition mapping and its guard/error branches.
 * `fromSmallestUnit` is intentionally left un-mocked so the real numeric
 * conversion is asserted end to end.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  clientMethods,
  ClientMock,
  networksMock,
  getAvailableTokens,
  depositToPool,
  withdrawFromPool,
  borrowFromPool,
  repayPool,
  addCollateral,
  removeCollateral,
} = vi.hoisted(() => {
  const clientMethods = {
    get_pool_balance: vi.fn(),
    get_interest_rate: vi.fn(),
    get_pool_state: vi.fn(),
    get_b_token_balance: vi.fn(),
    get_d_token_rate: vi.fn(),
  };
  class ClientMock {
    constructor() {
      Object.assign(this, clientMethods);
    }
  }
  return {
    clientMethods,
    ClientMock,
    networksMock: {
      testnet: { pool1ContractId: "CPOOL1", pool2ContractId: "CPOOL2" },
    },
    getAvailableTokens: vi.fn(),
    depositToPool: vi.fn(),
    withdrawFromPool: vi.fn(),
    borrowFromPool: vi.fn(),
    repayPool: vi.fn(),
    addCollateral: vi.fn(),
    removeCollateral: vi.fn(),
  };
});

vi.mock("@neko/lending", () => ({
  Client: ClientMock,
  networks: networksMock,
}));
vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getAvailableTokens,
}));
vi.mock("@/lib/helpers/stellar/lending", () => ({
  depositToPool,
  withdrawFromPool,
  borrowFromPool,
  repayPool,
  addCollateral,
  removeCollateral,
}));

import { NekoLendingAdapter } from "../NekoLendingAdapter";
import { AdapterError, UnsupportedActionError } from "../../types/errors";

const USDC = {
  contract: "C_USDC",
  code: "USDC",
  name: "USD Coin",
  decimals: 7,
};

beforeEach(() => {
  vi.clearAllMocks();
  getAvailableTokens.mockReturnValue({
    USDC,
    CETES: { ...USDC, code: "CETES" },
  });
  depositToPool.mockResolvedValue("DEPOSIT_XDR");
  withdrawFromPool.mockResolvedValue("WITHDRAW_XDR");
  borrowFromPool.mockResolvedValue("BORROW_XDR");
  repayPool.mockResolvedValue("REPAY_XDR");
  addCollateral.mockResolvedValue("ADD_COLLATERAL_XDR");
  removeCollateral.mockResolvedValue("REMOVE_COLLATERAL_XDR");
  clientMethods.get_pool_balance.mockResolvedValue({ result: 5000n });
  clientMethods.get_interest_rate.mockResolvedValue({ result: 250 });
  clientMethods.get_pool_state.mockResolvedValue({ result: { tag: "Active" } });
  clientMethods.get_b_token_balance.mockResolvedValue({ result: 15_000_000n });
  // SCALAR_12 (1e12) => underlying == dTokens 1:1 by default in tests.
  clientMethods.get_d_token_rate.mockResolvedValue({
    result: 1_000_000_000_000n,
  });
});

describe("NekoLendingAdapter – deposit", () => {
  it("converts the raw amount to a human amount and routes to pool 1", async () => {
    const adapter = new NekoLendingAdapter();
    const result = await adapter.deposit("USDC", "GUSER", 10_000_000n);

    // 10_000_000 raw / 10^7 decimals => "1"
    expect(depositToPool).toHaveBeenCalledWith(
      "USDC",
      "1",
      7,
      "GUSER",
      "CPOOL1"
    );
    expect(result).toEqual({
      xdr: "DEPOSIT_XDR",
      networkPassphrase: expect.any(String),
    });
  });

  it("routes pool-2 collateral assets to the pool 2 contract", async () => {
    const adapter = new NekoLendingAdapter();
    await adapter.deposit("CETES", "GUSER", 15_000_000n);

    // 15_000_000 raw / 10^7 => "1.5"
    expect(depositToPool).toHaveBeenCalledWith(
      "CETES",
      "1.5",
      7,
      "GUSER",
      "CPOOL2"
    );
  });

  it("wraps a builder failure in an AdapterError", async () => {
    depositToPool.mockRejectedValue(new Error("rpc down"));
    const adapter = new NekoLendingAdapter();

    await expect(adapter.deposit("USDC", "GUSER", 1n)).rejects.toBeInstanceOf(
      AdapterError
    );
  });
});

describe("NekoLendingAdapter – withdraw", () => {
  it("builds the withdraw tx with the converted amount", async () => {
    const adapter = new NekoLendingAdapter();
    const result = await adapter.withdraw("USDC", "GUSER", 10_000_000n);

    expect(withdrawFromPool).toHaveBeenCalledWith(
      "USDC",
      "1",
      7,
      "GUSER",
      "CPOOL1"
    );
    expect(result.xdr).toBe("WITHDRAW_XDR");
  });
});

describe("NekoLendingAdapter – getPoolInfo", () => {
  it("maps balance, interest rate and pool state into a PoolInfo", async () => {
    const adapter = new NekoLendingAdapter();
    const info = await adapter.getPoolInfo("USDC");

    expect(info).toMatchObject({
      id: "neko:USDC",
      type: "neko",
      name: "USDC Lending Pool",
      tvl: 5000n,
      apy: 2.5, // 250 / 100
      state: "active",
      supportedActions: [
        "deposit",
        "withdraw",
        "borrow",
        "repay",
        "supplyCollateral",
        "withdrawCollateral",
      ],
      metadata: { contractId: "CPOOL1", assetCode: "USDC" },
    });
    expect(info.tokens[0]).toMatchObject({ address: "C_USDC", code: "USDC" });
  });

  it("maps a Frozen pool-state tag to the 'frozen' state", async () => {
    clientMethods.get_pool_state.mockResolvedValue({
      result: { tag: "Frozen" },
    });
    const adapter = new NekoLendingAdapter();

    expect((await adapter.getPoolInfo("USDC")).state).toBe("frozen");
  });

  it("unwraps a Result<Ok> interest rate into an APY", async () => {
    clientMethods.get_interest_rate.mockResolvedValue({
      result: { tag: "Ok", values: ["300"] },
    });
    const adapter = new NekoLendingAdapter();

    expect((await adapter.getPoolInfo("USDC")).apy).toBe(3); // 300 / 100
  });

  it("throws an AdapterError for an unknown asset", async () => {
    getAvailableTokens.mockReturnValue({});
    const adapter = new NekoLendingAdapter();

    await expect(adapter.getPoolInfo("NOPE")).rejects.toBeInstanceOf(
      AdapterError
    );
    expect(clientMethods.get_pool_balance).not.toHaveBeenCalled();
  });
});

describe("NekoLendingAdapter – getUserPosition", () => {
  it("returns the b-token balance formatted to human units", async () => {
    const adapter = new NekoLendingAdapter();
    const position = await adapter.getUserPosition("USDC", "GUSER");

    expect(position).toMatchObject({
      poolId: "neko:USDC",
      deposited: 15_000_000n,
      depositedFormatted: "1.5",
      rewards: 0n,
      metadata: { bTokenBalance: "15000000" },
    });
  });

  it("reports the balance as plain supply with no collateral or debt", async () => {
    const adapter = new NekoLendingAdapter();
    const position = await adapter.getUserPosition("USDC", "GUSER");

    // Neko has no collateral bucket, so the shape degrades to supply-only and
    // `withdraw` keeps the exact ceiling it had before issue #296.
    expect(position.supplied).toBe(15_000_000n);
    expect(position.suppliedFormatted).toBe("1.5");
    expect(position.collateral).toBe(0n);
    expect(position.liabilities).toBe(0n);
    expect(position.limits).toEqual({ withdraw: 15_000_000n });
  });

  it("falls back to an empty position when the balance call fails", async () => {
    clientMethods.get_b_token_balance.mockRejectedValue(new Error("boom"));
    const adapter = new NekoLendingAdapter();
    const position = await adapter.getUserPosition("USDC", "GUSER");

    expect(position).toMatchObject({
      poolId: "neko:USDC",
      deposited: 0n,
      depositedFormatted: "0",
      supplied: 0n,
      collateral: 0n,
      liabilities: 0n,
      limits: {},
      metadata: {},
    });
  });
});

describe("NekoLendingAdapter – capabilities", () => {
  it("supports deposit, withdraw, borrow, repay, and collateral actions", () => {
    const adapter = new NekoLendingAdapter();
    expect(adapter.supportsAction("deposit")).toBe(true);
    expect(adapter.supportsAction("withdraw")).toBe(true);
    expect(adapter.supportsAction("borrow")).toBe(true);
    expect(adapter.supportsAction("repay")).toBe(true);
    expect(adapter.supportsAction("supplyCollateral")).toBe(true);
    expect(adapter.supportsAction("withdrawCollateral")).toBe(true);
    expect(adapter.supportsAction("claimRewards")).toBe(false);
  });

  it("rejects claimRewards as unsupported", async () => {
    const adapter = new NekoLendingAdapter();
    await expect(adapter.claimRewards()).rejects.toBeInstanceOf(
      UnsupportedActionError
    );
  });
});

describe("NekoLendingAdapter – borrow", () => {
  it("converts the raw amount to a human amount and routes to the debt asset's pool", async () => {
    const adapter = new NekoLendingAdapter();
    const result = await adapter.borrow("USDC", "GUSER", 10_000_000n);

    expect(borrowFromPool).toHaveBeenCalledWith(
      "USDC",
      "1",
      7,
      "GUSER",
      "CPOOL1"
    );
    expect(result.xdr).toBe("BORROW_XDR");
  });

  it("wraps a builder failure in an AdapterError", async () => {
    borrowFromPool.mockRejectedValue(new Error("rpc down"));
    const adapter = new NekoLendingAdapter();

    await expect(adapter.borrow("USDC", "GUSER", 1n)).rejects.toBeInstanceOf(
      AdapterError
    );
  });
});

describe("NekoLendingAdapter – repay", () => {
  it("converts underlying-asset amount to dTokens via the pool's d_token rate", async () => {
    const adapter = new NekoLendingAdapter();
    // d_rate = 1e12 (1:1) in the default mock, so 10_000_000 underlying -> 10_000_000 dTokens.
    await adapter.repay("USDC", "GUSER", 10_000_000n);

    expect(repayPool).toHaveBeenCalledWith(
      "USDC",
      10_000_000n,
      "GUSER",
      "CPOOL1"
    );
  });

  it("scales dTokens down when the d_token rate is above 1:1", async () => {
    // d_rate = 2e12 => underlying = dTokens * 2, so dTokens = underlying / 2.
    clientMethods.get_d_token_rate.mockResolvedValue({
      result: 2_000_000_000_000n,
    });
    const adapter = new NekoLendingAdapter();
    await adapter.repay("USDC", "GUSER", 10_000_000n);

    expect(repayPool).toHaveBeenCalledWith(
      "USDC",
      5_000_000n,
      "GUSER",
      "CPOOL1"
    );
  });

  it("wraps a zero d_token rate (no active debt) in an AdapterError", async () => {
    clientMethods.get_d_token_rate.mockResolvedValue({ result: 0n });
    const adapter = new NekoLendingAdapter();

    await expect(adapter.repay("USDC", "GUSER", 1n)).rejects.toBeInstanceOf(
      AdapterError
    );
    expect(repayPool).not.toHaveBeenCalled();
  });
});

describe("NekoLendingAdapter – supplyCollateral / withdrawCollateral", () => {
  it("parses the <poolContractId>:<rwaTokenAddress> raw id and calls addCollateral", async () => {
    const adapter = new NekoLendingAdapter();
    const result = await adapter.supplyCollateral(
      "CPOOL1:C_RWA_TOKEN",
      "GUSER",
      10_000_000n
    );

    expect(addCollateral).toHaveBeenCalledWith(
      "C_RWA_TOKEN",
      "1",
      7,
      "GUSER",
      "CPOOL1"
    );
    expect(result.xdr).toBe("ADD_COLLATERAL_XDR");
  });

  it("parses the raw id and calls removeCollateral", async () => {
    const adapter = new NekoLendingAdapter();
    const result = await adapter.withdrawCollateral(
      "CPOOL1:C_RWA_TOKEN",
      "GUSER",
      5_000_000n
    );

    expect(removeCollateral).toHaveBeenCalledWith(
      "C_RWA_TOKEN",
      "0.5",
      7,
      "GUSER",
      "CPOOL1"
    );
    expect(result.xdr).toBe("REMOVE_COLLATERAL_XDR");
  });

  it("throws an AdapterError for a malformed raw id", async () => {
    const adapter = new NekoLendingAdapter();
    await expect(
      adapter.supplyCollateral("no-colon-here", "GUSER", 1n)
    ).rejects.toBeInstanceOf(AdapterError);
    expect(addCollateral).not.toHaveBeenCalled();
  });
});
