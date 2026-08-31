import type { PortfolioHolding } from "../hooks/usePortfolioValue";
import type { UserPositionWithPool } from "../hooks/useUserPositions";
import type { LendingPosition } from "@/features/lending/hooks/useUserLendingPositions";
import type { BorrowPosition } from "@/features/borrowing/hooks/useUserBorrowPositions";
import type { BackstopPositionRaw } from "./usePortfolioBackstopPositions";
import type { LeveragePositionSummary } from "./leverage";
import type {
  PortfolioSummary,
  ProtocolAllocation,
  ProtocolKind,
  UnifiedPosition,
} from "./types";

const STELLAR_DECIMALS = 7;

/** Resolves an asset code to a USD price, or null when none is available. */
export type PriceLookup = (assetCode: string) => number | null;

export interface VaultPositionRaw {
  quantity: number;
  supplyAssetCode: string;
  apy: number | null;
}

/** Wallet spot balances already carry their own priceUsd — pass it through as-is. */
export function normalizeWalletHoldings(
  holdings: PortfolioHolding[]
): UnifiedPosition[] {
  return holdings.map((h) => ({
    id: `wallet:${h.code}`,
    protocol: "wallet",
    label: h.code,
    assetCode: h.code,
    quantity: h.balance,
    valueUsd: h.valueUsd,
    direction: "asset",
    href: "/swap",
  }));
}

export function normalizeLendingPositions(
  positions: LendingPosition[],
  getPrice: PriceLookup
): UnifiedPosition[] {
  return positions.map((p) => {
    const price = getPrice(p.assetCode);
    return {
      id: `lending:${p.assetCode}`,
      protocol: "lending",
      label: `${p.assetCode} supplied`,
      assetCode: p.assetCode,
      quantity: p.deposited,
      valueUsd: price !== null ? p.deposited * price : null,
      direction: "asset",
      apy: p.interestRate,
      href: "/lending",
    };
  });
}

/**
 * Debt lowers net worth (liability); collateral is deduplicated by token
 * code because the borrowing hook queries collateral per (debt asset,
 * collateral token) pair — the same physical deposit can back several debt
 * positions and must only be counted once toward the portfolio total.
 */
export function normalizeBorrowPositions(
  positions: BorrowPosition[],
  getPrice: PriceLookup
): UnifiedPosition[] {
  const result: UnifiedPosition[] = [];
  const seenCollateral = new Set<string>();

  for (const p of positions) {
    const debtQuantity = Number(p.debtRaw) / 10 ** STELLAR_DECIMALS;
    if (debtQuantity > 0) {
      const price = getPrice(p.assetCode);
      result.push({
        id: `borrowing:debt:${p.assetCode}`,
        protocol: "borrowing",
        label: `${p.assetCode} borrowed`,
        assetCode: p.assetCode,
        quantity: debtQuantity,
        valueUsd: price !== null ? debtQuantity * price : null,
        direction: "liability",
        apy: p.interestRate,
        href: "/borrowing",
      });
    }

    const collateralQuantity = Number(p.collateralRaw) / 10 ** STELLAR_DECIMALS;
    if (collateralQuantity > 0 && !seenCollateral.has(p.collateralTokenCode)) {
      seenCollateral.add(p.collateralTokenCode);
      const price = getPrice(p.collateralTokenCode);
      result.push({
        id: `borrowing:collateral:${p.collateralTokenCode}`,
        protocol: "borrowing",
        label: `${p.collateralTokenCode} collateral`,
        assetCode: p.collateralTokenCode,
        quantity: collateralQuantity,
        valueUsd: price !== null ? collateralQuantity * price : null,
        direction: "asset",
        href: "/borrowing",
      });
    }
  }

  return result;
}

/**
 * Single-asset pools (Blend, Neko) can be priced from their one token.
 * Soroswap AMM pools hold a basket of two reserves behind one LP balance —
 * valuing that correctly needs pool reserves, not just a token price, so it
 * is left unpriced rather than guessed.
 */
export function normalizePoolPositions(
  positions: UserPositionWithPool[],
  getPrice: PriceLookup
): UnifiedPosition[] {
  return positions.map(({ pool, position }) => {
    const primaryToken = pool.tokens[0];
    const decimals = primaryToken?.decimals ?? STELLAR_DECIMALS;
    const quantity = Number(position.deposited) / 10 ** decimals;
    const isSingleAssetPool = pool.type === "blend" || pool.type === "neko";
    const price =
      isSingleAssetPool && primaryToken ? getPrice(primaryToken.code) : null;

    return {
      id: `pools:${pool.id}`,
      protocol: "pools",
      label: pool.name,
      assetCode: primaryToken?.code ?? pool.tokens.map((t) => t.code).join("/"),
      quantity,
      valueUsd: price !== null ? quantity * price : null,
      direction: "asset",
      apy: pool.apy,
      href: `/pools/${encodeURIComponent(pool.id)}`,
    };
  });
}

export function normalizeVaultPosition(
  position: VaultPositionRaw | null,
  getPrice: PriceLookup
): UnifiedPosition[] {
  if (!position || position.quantity <= 0) return [];
  const price = getPrice(position.supplyAssetCode);
  return [
    {
      id: "vault:neko-usdc-cetes",
      protocol: "vault",
      label: `${position.supplyAssetCode} vault deposit`,
      assetCode: position.supplyAssetCode,
      quantity: position.quantity,
      valueUsd: price !== null ? position.quantity * price : null,
      direction: "asset",
      apy: position.apy,
      href: "/vault",
    },
  ];
}

/**
 * Backstop token address is set at runtime by the contract admin, so it may
 * not resolve to a known asset code — in that case the position is reported
 * with its native quantity but no valueUsd.
 */
export function normalizeBackstopPositions(
  positions: BackstopPositionRaw[],
  getPrice: PriceLookup
): UnifiedPosition[] {
  return positions.map((p) => {
    const price = p.assetCode ? getPrice(p.assetCode) : null;
    return {
      id: `backstop:${p.key}`,
      protocol: "backstop",
      label: `${p.label} backstop deposit`,
      assetCode: p.assetCode ?? "Unknown",
      quantity: p.amount,
      valueUsd: price !== null ? p.amount * price : null,
      direction: "asset",
      href: "/lending",
    };
  });
}

/**
 * Turns an aggregated leverage-loop position (features/dashboard/positions/
 * leverage.ts's reducer) into two UnifiedPosition rows — a collateral asset
 * row and a debt liability row — mirroring normalizeBorrowPositions's
 * pattern so aggregatePortfolio's net-worth math (assets minus liabilities)
 * falls out for free instead of needing a leverage-specific case.
 */
export function normalizeLeveragePositions(
  positions: LeveragePositionSummary[]
): UnifiedPosition[] {
  const result: UnifiedPosition[] = [];

  for (const p of positions) {
    const multipleLabel =
      p.effectiveLeverage != null ? ` ${p.effectiveLeverage.toFixed(2)}x` : "";
    result.push({
      id: `leverage:${p.strategyId}:collateral`,
      protocol: "leverage",
      label: `${p.assetCode} leveraged position${multipleLabel}`,
      assetCode: p.assetCode,
      quantity: p.totalCollateralUnits,
      valueUsd: p.collateralValueUsd,
      direction: "asset",
      href: "/strategies",
    });

    if (p.totalDebtUnits > 0) {
      result.push({
        id: `leverage:${p.strategyId}:debt`,
        protocol: "leverage",
        label: `${p.borrowAssetCode} borrowed (leverage loop)`,
        assetCode: p.borrowAssetCode,
        quantity: p.totalDebtUnits,
        valueUsd: p.debtValueUsd,
        direction: "liability",
        href: "/strategies",
      });
    }
  }

  return result;
}

export function aggregatePortfolio(
  positions: UnifiedPosition[],
  isLoading: boolean,
  hasWallet: boolean
): PortfolioSummary {
  let totalAssetsUsd = 0;
  let totalLiabilitiesUsd = 0;
  let unpricedPositionCount = 0;
  const byProtocolMap = new Map<ProtocolKind, ProtocolAllocation>();

  for (const pos of positions) {
    if (pos.valueUsd === null) {
      unpricedPositionCount += 1;
    } else if (pos.direction === "liability") {
      totalLiabilitiesUsd += pos.valueUsd;
    } else {
      totalAssetsUsd += pos.valueUsd;
    }

    const signedValue =
      pos.valueUsd === null
        ? 0
        : pos.direction === "liability"
          ? -pos.valueUsd
          : pos.valueUsd;

    const existing = byProtocolMap.get(pos.protocol);
    if (existing) {
      existing.valueUsd += signedValue;
      existing.positionCount += 1;
    } else {
      byProtocolMap.set(pos.protocol, {
        protocol: pos.protocol,
        valueUsd: signedValue,
        positionCount: 1,
      });
    }
  }

  return {
    positions,
    totalValueUsd: totalAssetsUsd - totalLiabilitiesUsd,
    totalAssetsUsd,
    totalLiabilitiesUsd,
    unpricedPositionCount,
    byProtocol: Array.from(byProtocolMap.values()),
    isLoading,
    hasWallet,
  };
}
