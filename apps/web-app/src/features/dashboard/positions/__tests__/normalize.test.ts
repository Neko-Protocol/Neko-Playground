/**
 * Unit tests for the unified position engine's pure normalization and
 * aggregation logic (issue #260). No wallet/network/jsdom is needed — every
 * function here takes already-fetched hook data and a price lookup, so the
 * suite runs against the default (node) vitest environment.
 */
import { describe, expect, it } from "vitest";
import type { PortfolioHolding } from "../../hooks/usePortfolioValue";
import type { UserPositionWithPool } from "../../hooks/useUserPositions";
import type { LendingPosition } from "@/features/lending/hooks/useUserLendingPositions";
import type { BorrowPosition } from "@/features/borrowing/hooks/useUserBorrowPositions";
import type {
  PoolInfo,
  PoolPosition,
} from "@/lib/orchestrator/types/pool.types";
import type { BackstopPositionRaw } from "../usePortfolioBackstopPositions";
import {
  aggregatePortfolio,
  normalizeBackstopPositions,
  normalizeBorrowPositions,
  normalizeLendingPositions,
  normalizePoolPositions,
  normalizeVaultPosition,
  normalizeWalletHoldings,
  type PriceLookup,
} from "../normalize";

const priceOf =
  (prices: Record<string, number>): PriceLookup =>
  (code) =>
    code in prices ? prices[code] : null;

function makePool(overrides: Partial<PoolInfo> = {}): PoolInfo {
  return {
    id: "pool-1",
    type: "blend",
    name: "USDC Pool",
    tokens: [{ address: "CUSDC", code: "USDC", name: "USD Coin", decimals: 7 }],
    tvl: 0n,
    apy: 5,
    state: "active",
    supportedActions: ["deposit", "withdraw"],
    metadata: {},
    ...overrides,
  };
}

function makePosition(overrides: Partial<PoolPosition> = {}): PoolPosition {
  return {
    poolId: "pool-1",
    deposited: 100_0000000n,
    depositedFormatted: "100",
    rewards: 0n,
    rewardsFormatted: "0",
    metadata: {},
    ...overrides,
  };
}

describe("normalizeWalletHoldings", () => {
  it("passes through the holding's existing valueUsd unchanged", () => {
    const holdings: PortfolioHolding[] = [
      { code: "USDC", balance: 50, priceUsd: 1, valueUsd: 50 },
    ];
    expect(normalizeWalletHoldings(holdings)).toEqual([
      expect.objectContaining({
        protocol: "wallet",
        assetCode: "USDC",
        quantity: 50,
        valueUsd: 50,
        direction: "asset",
      }),
    ]);
  });
});

describe("normalizeLendingPositions", () => {
  it("prices a supply position from the raw deposited amount", () => {
    const positions: LendingPosition[] = [
      {
        assetCode: "USDC",
        bTokens: 100n,
        bTokensFormatted: "100",
        bTokenRate: "1",
        deposited: 100,
        depositedFormatted: "100",
        interestRate: 5.5,
      },
    ];
    const result = normalizeLendingPositions(positions, priceOf({ USDC: 1 }));
    expect(result).toEqual([
      expect.objectContaining({
        protocol: "lending",
        assetCode: "USDC",
        quantity: 100,
        valueUsd: 100,
        direction: "asset",
        apy: 5.5,
      }),
    ]);
  });

  it("reports valueUsd as null when no price is available", () => {
    const positions: LendingPosition[] = [
      {
        assetCode: "KTB",
        bTokens: 1n,
        bTokensFormatted: "1",
        bTokenRate: "1",
        deposited: 10,
        depositedFormatted: "10",
        interestRate: 3,
      },
    ];
    const result = normalizeLendingPositions(positions, priceOf({}));
    expect(result[0].valueUsd).toBeNull();
  });
});

describe("normalizeBorrowPositions", () => {
  const STELLAR_DECIMALS = 7n;
  const scale = 10n ** STELLAR_DECIMALS;

  it("marks debt as a liability and collateral as an asset", () => {
    const positions: BorrowPosition[] = [
      {
        assetCode: "USTRY",
        collateralTokenCode: "USDC",
        collateralToken: "CUSDC",
        contractId: "CPOOL",
        dTokens: 1n,
        dTokensFormatted: "1",
        dRate: 1n,
        debtRaw: 200n * scale,
        debtFormatted: "200",
        collateralRaw: 500n * scale,
        collateralFormatted: "500",
        interestRate: 7,
      },
    ];

    const result = normalizeBorrowPositions(
      positions,
      priceOf({ USTRY: 100, USDC: 1 })
    );

    expect(result).toEqual([
      expect.objectContaining({
        protocol: "borrowing",
        assetCode: "USTRY",
        quantity: 200,
        valueUsd: 20_000,
        direction: "liability",
      }),
      expect.objectContaining({
        protocol: "borrowing",
        assetCode: "USDC",
        quantity: 500,
        valueUsd: 500,
        direction: "asset",
      }),
    ]);
  });

  it("counts shared collateral once even when it backs multiple debt assets", () => {
    const shared: Omit<BorrowPosition, "assetCode" | "debtRaw"> = {
      collateralTokenCode: "USDC",
      collateralToken: "CUSDC",
      contractId: "CPOOL",
      dTokens: 1n,
      dTokensFormatted: "1",
      dRate: 1n,
      debtFormatted: "0",
      collateralRaw: 500n * scale,
      collateralFormatted: "500",
      interestRate: 7,
    };
    const positions: BorrowPosition[] = [
      { ...shared, assetCode: "USTRY", debtRaw: 100n * scale },
      { ...shared, assetCode: "CETES", debtRaw: 50n * scale },
    ];

    const result = normalizeBorrowPositions(
      positions,
      priceOf({ USTRY: 1, CETES: 1, USDC: 1 })
    );

    const collateralEntries = result.filter((p) => p.direction === "asset");
    expect(collateralEntries).toHaveLength(1);
    expect(collateralEntries[0].valueUsd).toBe(500);
  });

  it("skips zero-amount debt or collateral", () => {
    const positions: BorrowPosition[] = [
      {
        assetCode: "USTRY",
        collateralTokenCode: "USDC",
        collateralToken: "CUSDC",
        contractId: "CPOOL",
        dTokens: 0n,
        dTokensFormatted: "0",
        dRate: 0n,
        debtRaw: 0n,
        debtFormatted: "0",
        collateralRaw: 0n,
        collateralFormatted: "0",
        interestRate: 7,
      },
    ];
    expect(normalizeBorrowPositions(positions, priceOf({}))).toEqual([]);
  });
});

describe("normalizePoolPositions", () => {
  it("prices single-asset pool types (blend/neko) from the primary token", () => {
    const positions: UserPositionWithPool[] = [
      { pool: makePool({ type: "blend" }), position: makePosition() },
    ];
    const result = normalizePoolPositions(positions, priceOf({ USDC: 1 }));
    expect(result).toEqual([
      expect.objectContaining({
        protocol: "pools",
        assetCode: "USDC",
        quantity: 100,
        valueUsd: 100,
        apy: 5,
      }),
    ]);
  });

  it("leaves soroswap AMM LP positions unpriced", () => {
    const positions: UserPositionWithPool[] = [
      {
        pool: makePool({
          type: "soroswap",
          tokens: [
            { address: "CUSDC", code: "USDC", name: "USD Coin", decimals: 7 },
            {
              address: "CXLM",
              code: "XLM",
              name: "Stellar Lumens",
              decimals: 7,
            },
          ],
        }),
        position: makePosition(),
      },
    ];
    const result = normalizePoolPositions(
      positions,
      priceOf({ USDC: 1, XLM: 0.1 })
    );
    expect(result[0].valueUsd).toBeNull();
  });
});

describe("normalizeVaultPosition", () => {
  it("returns no positions when there are no shares", () => {
    expect(normalizeVaultPosition(null, priceOf({ USDC: 1 }))).toEqual([]);
    expect(
      normalizeVaultPosition(
        { quantity: 0, supplyAssetCode: "USDC", apy: null },
        priceOf({ USDC: 1 })
      )
    ).toEqual([]);
  });

  it("prices the vault deposit via the supply asset", () => {
    const result = normalizeVaultPosition(
      { quantity: 250, supplyAssetCode: "USDC", apy: 8 },
      priceOf({ USDC: 1 })
    );
    expect(result).toEqual([
      expect.objectContaining({
        protocol: "vault",
        assetCode: "USDC",
        quantity: 250,
        valueUsd: 250,
        apy: 8,
      }),
    ]);
  });
});

describe("normalizeBackstopPositions", () => {
  it("prices a resolved backstop token", () => {
    const positions: BackstopPositionRaw[] = [
      { key: "pool1", label: "Crypto Pool", amount: 40, assetCode: "USDC" },
    ];
    const result = normalizeBackstopPositions(positions, priceOf({ USDC: 1 }));
    expect(result[0].valueUsd).toBe(40);
  });

  it("leaves an unresolved backstop token unpriced", () => {
    const positions: BackstopPositionRaw[] = [
      { key: "pool2", label: "RWA Pool", amount: 40, assetCode: null },
    ];
    const result = normalizeBackstopPositions(positions, priceOf({}));
    expect(result[0].valueUsd).toBeNull();
  });
});

describe("aggregatePortfolio", () => {
  it("nets liabilities against assets for the total and per-protocol breakdown", () => {
    const summary = aggregatePortfolio(
      [
        {
          id: "wallet:USDC",
          protocol: "wallet",
          label: "USDC",
          assetCode: "USDC",
          quantity: 100,
          valueUsd: 100,
          direction: "asset",
          href: "/swap",
        },
        {
          id: "borrowing:debt:USTRY",
          protocol: "borrowing",
          label: "USTRY borrowed",
          assetCode: "USTRY",
          quantity: 30,
          valueUsd: 30,
          direction: "liability",
          href: "/borrowing",
        },
      ],
      false,
      true
    );

    expect(summary.totalAssetsUsd).toBe(100);
    expect(summary.totalLiabilitiesUsd).toBe(30);
    expect(summary.totalValueUsd).toBe(70);
    expect(summary.unpricedPositionCount).toBe(0);
    expect(summary.byProtocol).toEqual(
      expect.arrayContaining([
        { protocol: "wallet", valueUsd: 100, positionCount: 1 },
        { protocol: "borrowing", valueUsd: -30, positionCount: 1 },
      ])
    );
  });

  it("counts unpriced positions without contributing to the total", () => {
    const summary = aggregatePortfolio(
      [
        {
          id: "pools:soroswap-1",
          protocol: "pools",
          label: "USDC/XLM Pool",
          assetCode: "USDC/XLM",
          quantity: 10,
          valueUsd: null,
          direction: "asset",
          href: "/pools/1",
        },
      ],
      false,
      true
    );

    expect(summary.totalValueUsd).toBe(0);
    expect(summary.unpricedPositionCount).toBe(1);
  });
});
