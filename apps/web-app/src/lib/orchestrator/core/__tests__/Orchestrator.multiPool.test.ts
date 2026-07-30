/**
 * Proves issue #284's fix at the real Orchestrator + BlendPoolAdapter
 * integration level (not just PoolRegistry in isolation with stub adapters).
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

// Orchestrator.ts has module-level registration of Neko/Soroswap (and Blend)
// adapters onto the singleton registry. Stub those constructors so importing
// the Orchestrator *class* does not pull real @neko/lending / soroswap deps.
// Our tests never use that singleton — they build a fresh PoolRegistry.
vi.mock("../../adapters/NekoLendingAdapter", () => ({
  NekoLendingAdapter: vi.fn(function () {
    return { type: "neko" };
  }),
}));
vi.mock("../../adapters/SoroswapPoolAdapter", () => ({
  SoroswapPoolAdapter: vi.fn(function () {
    return { type: "soroswap" };
  }),
}));
vi.mock("../../adapters/blend-config", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../adapters/blend-config")>();
  return {
    ...actual,
    getBlendPoolIds: () => [],
  };
});

import { PoolRegistry } from "../PoolRegistry";
import { Orchestrator } from "../Orchestrator";
import { BlendPoolAdapter } from "../../adapters/BlendPoolAdapter";

const POOL_A = "CPOOLA";
const ASSET_A = "CASSETA";
const POOL_B = "CPOOLB";
const ASSET_B = "CASSETB";
const USER = "GUSER";

const TVL_A = 1000n;
const APY_A = 0.05;
const TVL_B = 2000n;
const APY_B = 0.08;

function makeReserve(totalSupply: bigint, estSupplyApy: number) {
  return {
    totalSupply: () => totalSupply,
    estSupplyApy,
    estBorrowApy: estSupplyApy * 1.5,
    config: { decimals: 7 },
    getCollateralFactor: () => 0.75,
    getLiabilityFactor: () => 1.25,
    totalLiabilities: () => 0n,
    getUtilizationFloat: () => 0.1,
  };
}

function makePoolData(
  assetAddress: string,
  totalSupply: bigint,
  estSupplyApy: number,
  poolName: string
) {
  return {
    reserves: new Map([[assetAddress, makeReserve(totalSupply, estSupplyApy)]]),
    metadata: { status: 0, name: poolName },
  };
}

let orchestrator: Orchestrator;

beforeEach(() => {
  vi.clearAllMocks();
  submitMock.mockReturnValue("OP_XDR");
  claimMock.mockReturnValue("CLAIM_XDR");

  poolLoadMock.mockImplementation(
    async (_network: unknown, poolContractId: string) => {
      if (poolContractId === POOL_A) {
        return makePoolData(ASSET_A, TVL_A, APY_A, "Pool A");
      }
      if (poolContractId === POOL_B) {
        return makePoolData(ASSET_B, TVL_B, APY_B, "Pool B");
      }
      throw new Error(`Unexpected poolContractId: ${poolContractId}`);
    }
  );

  tokenMetaLoadMock.mockImplementation(
    async (_network: unknown, assetAddress: string) => {
      if (assetAddress === ASSET_A) {
        return { symbol: "AAA", name: "Asset A", decimals: 7 };
      }
      if (assetAddress === ASSET_B) {
        return { symbol: "BBB", name: "Asset B", decimals: 7 };
      }
      return { symbol: "UNK", name: assetAddress, decimals: 7 };
    }
  );

  const registry = new PoolRegistry();
  registry.register(new BlendPoolAdapter(POOL_A));
  registry.register(new BlendPoolAdapter(POOL_B));
  orchestrator = new Orchestrator(registry);
});

describe("Orchestrator + multi BlendPoolAdapter (issue #284)", () => {
  it("getAllPools() aggregates reserves from every registered Blend adapter", async () => {
    const pools = await orchestrator.getAllPools();

    expect(pools).toHaveLength(2);

    const poolA = pools.find((p) => p.id === `blend:${POOL_A}:${ASSET_A}`);
    const poolB = pools.find((p) => p.id === `blend:${POOL_B}:${ASSET_B}`);

    expect(poolA).toBeDefined();
    expect(poolA!.tvl).toBe(TVL_A);
    expect(poolA!.apy).toBe(APY_A * 100);

    expect(poolB).toBeDefined();
    expect(poolB!.tvl).toBe(TVL_B);
    expect(poolB!.apy).toBe(APY_B * 100);

    const ids = pools.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolve()-driven getPoolInfo / deposit route by raw id, not adapter instance", async () => {
    const infoA = await orchestrator.getPoolInfo(`blend:${POOL_A}:${ASSET_A}`);
    expect(infoA.tvl).toBe(TVL_A);
    expect(infoA.apy).toBe(APY_A * 100);

    const infoB = await orchestrator.getPoolInfo(`blend:${POOL_B}:${ASSET_B}`);
    expect(infoB.tvl).toBe(TVL_B);
    expect(infoB.apy).toBe(APY_B * 100);

    await orchestrator.deposit(`blend:${POOL_A}:${ASSET_A}`, USER, 100n);
    expect(PoolContractV2Mock).toHaveBeenCalledWith(POOL_A);

    PoolContractV2Mock.mockClear();

    await orchestrator.deposit(`blend:${POOL_B}:${ASSET_B}`, USER, 100n);
    expect(PoolContractV2Mock).toHaveBeenCalledWith(POOL_B);
  });
});
