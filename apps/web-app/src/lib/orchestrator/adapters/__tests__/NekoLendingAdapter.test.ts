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
} = vi.hoisted(() => {
  const clientMethods = {
    get_pool_balance: vi.fn(),
    get_interest_rate: vi.fn(),
    get_pool_state: vi.fn(),
    get_b_token_balance: vi.fn(),
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
  clientMethods.get_pool_balance.mockResolvedValue({ result: 5000n });
  clientMethods.get_interest_rate.mockResolvedValue({ result: 250 });
  clientMethods.get_pool_state.mockResolvedValue({ result: { tag: "Active" } });
  clientMethods.get_b_token_balance.mockResolvedValue({ result: 15_000_000n });
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
      supportedActions: ["deposit", "withdraw"],
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

  it("falls back to an empty position when the balance call fails", async () => {
    clientMethods.get_b_token_balance.mockRejectedValue(new Error("boom"));
    const adapter = new NekoLendingAdapter();
    const position = await adapter.getUserPosition("USDC", "GUSER");

    expect(position).toMatchObject({
      poolId: "neko:USDC",
      deposited: 0n,
      depositedFormatted: "0",
      metadata: {},
    });
  });
});

describe("NekoLendingAdapter – capabilities", () => {
  it("supports only deposit and withdraw actions", () => {
    const adapter = new NekoLendingAdapter();
    expect(adapter.supportsAction("deposit")).toBe(true);
    expect(adapter.supportsAction("withdraw")).toBe(true);
    expect(adapter.supportsAction("borrow")).toBe(false);
  });

  it("rejects claimRewards as unsupported", async () => {
    const adapter = new NekoLendingAdapter();
    await expect(adapter.claimRewards()).rejects.toBeInstanceOf(
      UnsupportedActionError
    );
  });
});
