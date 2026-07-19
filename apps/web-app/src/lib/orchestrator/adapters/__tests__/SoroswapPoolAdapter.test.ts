/**
 * Tests for SoroswapPoolAdapter — the orchestrator adapter that maps SoroSwap
 * pools into the unified PoolInfo shape and builds add-liquidity (deposit)
 * transactions (issue #255).
 *
 * The SoroSwap helpers (getPool, addLiquidity, getAvailableTokens) are mocked so
 * no network / stellar-sdk code runs. The tests characterize the adapter's own
 * transformation logic: pool-id parsing, token resolution, reserve/TVL/unit
 * normalization, the deposit build args, and the unsupported-action guards.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getPool, addLiquidity, getAvailableTokens, tokens } = vi.hoisted(() => {
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
    getAvailableTokens: vi.fn(() => tokens),
    tokens,
  };
});

vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getPool,
  addLiquidity,
  getAvailableTokens,
}));

import { SoroswapPoolAdapter } from "../SoroswapPoolAdapter";
import { AdapterError, UnsupportedActionError } from "../../types/errors";
import { networkPassphrase } from "@/lib/constants/network";

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
  it("rejects withdraw as an unsupported action", async () => {
    await expect(adapter.withdraw()).rejects.toBeInstanceOf(
      UnsupportedActionError
    );
  });

  it("rejects claimRewards as an unsupported action", async () => {
    await expect(adapter.claimRewards()).rejects.toBeInstanceOf(
      UnsupportedActionError
    );
  });

  it("reports supportsAction for deposit but not withdraw or claimRewards", () => {
    expect(adapter.supportsAction("deposit")).toBe(true);
    expect(adapter.supportsAction("withdraw")).toBe(false);
    expect(adapter.supportsAction("claimRewards")).toBe(false);
  });

  it("returns an empty zeroed position for getUserPosition", async () => {
    const position = await adapter.getUserPosition("XLM-USDC", "GUSER_ADDRESS");
    expect(position).toMatchObject({
      poolId: "soroswap:XLM-USDC",
      deposited: 0n,
      depositedFormatted: "0",
      rewards: 0n,
    });
  });
});
