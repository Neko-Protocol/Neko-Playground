/**
 * Tests for SoroswapPoolAdapter — the orchestrator adapter that maps SoroSwap
 * pools into the unified PoolInfo shape and builds add/remove-liquidity
 * (deposit/withdraw) transactions (issues #255, #283).
 *
 * The SoroSwap helpers (getPool, addLiquidity, removeLiquidity, getUserPositions,
 * getAvailableTokens) are mocked so no network / stellar-sdk code runs. The tests
 * characterize the adapter's own transformation logic: pool-id parsing, token
 * resolution, reserve/TVL/unit normalization, deposit/withdraw build args,
 * position lookup (including orientation swap), and the unsupported-action guards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  getPool,
  addLiquidity,
  removeLiquidity,
  getUserPositions,
  getAvailableTokens,
  tokens,
} = vi.hoisted(() => {
  const tokens = {
    XLM: {
      contract: "CXLMCONTRACT0000000000000000000000000000000000000000000",
      code: "XLM",
      name: "Stellar Lumens",
      decimals: 7,
    },
    USDC: {
      contract: "CUSDCCONTRACT000000000000000000000000000000000000000000",
      code: "USDC",
      name: "USD Coin",
      decimals: 6,
    },
  };
  return {
    getPool: vi.fn(),
    addLiquidity: vi.fn(),
    removeLiquidity: vi.fn(),
    getUserPositions: vi.fn(),
    getAvailableTokens: vi.fn(() => tokens),
    tokens,
  };
});

vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getPool,
  addLiquidity,
  removeLiquidity,
  getUserPositions,
  getAvailableTokens,
}));

import { SoroswapPoolAdapter } from "../SoroswapPoolAdapter";
import { AdapterError, UnsupportedActionError } from "../../types/errors";
import { networkPassphrase } from "@/lib/constants/network";

const mockUserPosition = {
  poolInformation: {
    protocol: "soroswap" as const,
    address: "CPOOLADDR",
    tokenA: {
      address: tokens.XLM.contract,
      name: "Stellar Lumens",
      symbol: "XLM",
    },
    tokenB: {
      address: tokens.USDC.contract,
      name: "USD Coin",
      symbol: "USDC",
    },
    reserveA: "30000000",
    reserveB: "5000000",
    totalSupply: "1000000",
    ledger: 42,
  },
  userPosition: "100000",
  userShares: 5,
  tokenAAmountEquivalent: "3000000",
  tokenBAmountEquivalent: "500000",
};

const unrelatedPosition = {
  poolInformation: {
    protocol: "soroswap" as const,
    address: "COTHERPOOL",
    tokenA: {
      address: "COTHERTOKENA000000000000000000000000000000000000000",
      name: "Other A",
      symbol: "OTA",
    },
    tokenB: {
      address: "COTHERTOKENB000000000000000000000000000000000000000",
      name: "Other B",
      symbol: "OTB",
    },
    reserveA: "1",
    reserveB: "1",
    totalSupply: "1",
    ledger: 1,
  },
  userPosition: "999",
  userShares: 1,
  tokenAAmountEquivalent: "1",
  tokenBAmountEquivalent: "1",
};

let adapter: SoroswapPoolAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  getAvailableTokens.mockReturnValue(tokens);
  adapter = new SoroswapPoolAdapter();
});

describe("SoroswapPoolAdapter – getPoolInfo", () => {
  it("maps an existing pool to a normalized PoolInfo with TVL and formatted reserves", async () => {
    getPool.mockResolvedValue([
      {
        address: "CPOOLADDR",
        protocol: "soroswap",
        reserveA: "30000000", // 3 XLM (7 decimals)
        reserveB: "5000000", // 5 USDC (6 decimals)
        ledger: 42,
      },
    ]);

    const info = await adapter.getPoolInfo("XLM-USDC");

    expect(getPool).toHaveBeenCalledWith({
      tokenA: tokens.XLM.contract,
      tokenB: tokens.USDC.contract,
    });
    expect(info).toMatchObject({
      id: "soroswap:XLM-USDC",
      type: "soroswap",
      name: "XLM / USDC",
      state: "active",
      tvl: 35000000n,
      apy: 0,
      supportedActions: ["deposit", "withdraw"],
    });
    expect(info.tokens.map((t) => t.code)).toEqual(["XLM", "USDC"]);
    expect(info.metadata).toMatchObject({
      poolAddress: "CPOOLADDR",
      reserveAFormatted: "3",
      reserveBFormatted: "5",
      ledger: 42,
    });
  });

  it("returns an 'unknown' placeholder pool when SoroSwap has no matching pool", async () => {
    getPool.mockResolvedValue([]);

    const info = await adapter.getPoolInfo("XLM-USDC");

    expect(info).toMatchObject({
      state: "unknown",
      tvl: 0n,
      metadata: { exists: false },
    });
  });

  it("throws on a malformed pool id before touching the network", async () => {
    await expect(adapter.getPoolInfo("XLMONLY")).rejects.toThrow(
      /Invalid SoroSwap pool id/
    );
    expect(getPool).not.toHaveBeenCalled();
  });

  it("throws on an unknown token code", async () => {
    await expect(adapter.getPoolInfo("XLM-DOGE")).rejects.toThrow(
      /Unknown token code: DOGE/
    );
  });

  it("wraps downstream failures in an AdapterError", async () => {
    getPool.mockRejectedValue(new Error("rpc down"));

    await expect(adapter.getPoolInfo("XLM-USDC")).rejects.toBeInstanceOf(
      AdapterError
    );
  });
});

describe("SoroswapPoolAdapter – deposit", () => {
  it("converts the raw amount to human units and builds the add-liquidity tx", async () => {
    addLiquidity.mockResolvedValue({ xdr: "ADD_LIQ_XDR" });

    const result = await adapter.deposit(
      "XLM-USDC",
      "GUSER_ADDRESS",
      12_345_000n // 1.2345 in 7-decimal XLM units
    );

    expect(addLiquidity).toHaveBeenCalledWith({
      assetA: tokens.XLM.contract,
      assetB: tokens.USDC.contract,
      amountA: "1.2345",
      amountB: "1.2345",
      to: "GUSER_ADDRESS",
    });
    expect(result).toEqual({ xdr: "ADD_LIQ_XDR", networkPassphrase });
  });

  it("wraps add-liquidity failures in an AdapterError", async () => {
    addLiquidity.mockRejectedValue(new Error("insufficient balance"));

    await expect(
      adapter.deposit("XLM-USDC", "GUSER_ADDRESS", 1n)
    ).rejects.toBeInstanceOf(AdapterError);
  });
});

describe("SoroswapPoolAdapter – unsupported actions & guards", () => {
  it("rejects claimRewards as an unsupported action", async () => {
    await expect(adapter.claimRewards()).rejects.toBeInstanceOf(
      UnsupportedActionError
    );
  });

  it("reports supportsAction for deposit and withdraw but not claimRewards", () => {
    expect(adapter.supportsAction("deposit")).toBe(true);
    expect(adapter.supportsAction("withdraw")).toBe(true);
    expect(adapter.supportsAction("claimRewards")).toBe(false);
  });
});

describe("SoroswapPoolAdapter – getUserPosition", () => {
  it("returns the matching position with correct orientation (tokenA = XLM)", async () => {
    getUserPositions.mockResolvedValue([unrelatedPosition, mockUserPosition]);

    const position = await adapter.getUserPosition("XLM-USDC", "GUSER_ADDRESS");

    expect(getUserPositions).toHaveBeenCalledWith("GUSER_ADDRESS");
    expect(position).toMatchObject({
      poolId: "soroswap:XLM-USDC",
      deposited: 3000000n,
      depositedFormatted: "0.3",
      rewards: 0n,
    });
  });

  it("picks the XLM-equivalent amount when pool orientation is reversed", async () => {
    const reversedPosition = {
      ...mockUserPosition,
      poolInformation: {
        ...mockUserPosition.poolInformation,
        tokenA: {
          address: tokens.USDC.contract,
          name: "USD Coin",
          symbol: "USDC",
        },
        tokenB: {
          address: tokens.XLM.contract,
          name: "Stellar Lumens",
          symbol: "XLM",
        },
        // With orientation swapped, tokenBAmountEquivalent is the XLM value
        reserveA: mockUserPosition.poolInformation.reserveB,
        reserveB: mockUserPosition.poolInformation.reserveA,
      },
      tokenAAmountEquivalent: "500000",
      tokenBAmountEquivalent: "3000000",
    };
    getUserPositions.mockResolvedValue([reversedPosition]);

    const position = await adapter.getUserPosition("XLM-USDC", "GUSER_ADDRESS");

    expect(position).toMatchObject({
      poolId: "soroswap:XLM-USDC",
      deposited: 3000000n,
      depositedFormatted: "0.3",
      rewards: 0n,
    });
  });

  it("returns a zeroed empty position when no matching pool is found", async () => {
    getUserPositions.mockResolvedValue([unrelatedPosition]);

    const position = await adapter.getUserPosition("XLM-USDC", "GUSER_ADDRESS");

    expect(position).toMatchObject({
      poolId: "soroswap:XLM-USDC",
      deposited: 0n,
      depositedFormatted: "0",
      rewards: 0n,
    });
  });

  it("swallows lookup failures and returns a zeroed empty position", async () => {
    getUserPositions.mockRejectedValue(new Error("rpc down"));

    await expect(
      adapter.getUserPosition("XLM-USDC", "GUSER_ADDRESS")
    ).resolves.toMatchObject({
      poolId: "soroswap:XLM-USDC",
      deposited: 0n,
      depositedFormatted: "0",
      rewards: 0n,
    });
  });
});

describe("SoroswapPoolAdapter – withdraw", () => {
  it("builds a partial withdraw with proportional LP shares and 95% min amounts", async () => {
    getUserPositions.mockResolvedValue([mockUserPosition]);
    removeLiquidity.mockResolvedValue({ xdr: "REMOVE_LIQ_XDR" });

    const result = await adapter.withdraw(
      "XLM-USDC",
      "GUSER_ADDRESS",
      1500000n
    );

    expect(removeLiquidity).toHaveBeenCalledWith({
      assetA: tokens.XLM.contract,
      assetB: tokens.USDC.contract,
      liquidity: "50000",
      amountA: "1425000",
      amountB: "237500",
      to: "GUSER_ADDRESS",
      slippageBps: 500,
    });
    expect(result).toEqual({ xdr: "REMOVE_LIQ_XDR", networkPassphrase });
  });

  it("uses the exact LP balance for a full withdraw", async () => {
    getUserPositions.mockResolvedValue([mockUserPosition]);
    removeLiquidity.mockResolvedValue({ xdr: "REMOVE_LIQ_XDR" });

    await adapter.withdraw("XLM-USDC", "GUSER_ADDRESS", 3000000n);

    expect(removeLiquidity).toHaveBeenCalledWith({
      assetA: tokens.XLM.contract,
      assetB: tokens.USDC.contract,
      liquidity: "100000",
      amountA: "2850000",
      amountB: "475000",
      to: "GUSER_ADDRESS",
      slippageBps: 500,
    });
  });

  it("rejects when no position is found", async () => {
    getUserPositions.mockResolvedValue([]);

    await expect(
      adapter.withdraw("XLM-USDC", "GUSER_ADDRESS", 1n)
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it("rejects when the amount exceeds the deposited balance", async () => {
    getUserPositions.mockResolvedValue([mockUserPosition]);

    await expect(
      adapter.withdraw("XLM-USDC", "GUSER_ADDRESS", 4000000n)
    ).rejects.toBeInstanceOf(AdapterError);
  });

  it("wraps removeLiquidity failures in an AdapterError", async () => {
    getUserPositions.mockResolvedValue([mockUserPosition]);
    removeLiquidity.mockRejectedValue(new Error("simulation failed"));

    await expect(
      adapter.withdraw("XLM-USDC", "GUSER_ADDRESS", 1500000n)
    ).rejects.toBeInstanceOf(AdapterError);
  });
});
