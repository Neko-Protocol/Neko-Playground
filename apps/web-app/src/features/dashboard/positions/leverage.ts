"use client";

import { useMemo, useState } from "react";
import {
  calculateLiquidationPrice,
  calculateProjectedHealthFactor,
} from "@/features/borrowing/utils/liquidationPrice";
import { listStrategies } from "@/lib/strategy/persistence";
import type { Strategy } from "@/lib/strategy/types";
import type { LeverageLoopStrategyMeta } from "@/lib/strategy/leverage/types";
import type { PriceLookup } from "./normalize";

/**
 * Reduces a leverage-loop strategy's routed iterations — potentially spread
 * across multiple pools (Scope §2's cross-protocol collateral) — into one
 * logical position (Scope §4). Deliberately computed from the STRATEGY'S
 * OWN persisted route rather than re-querying every touched pool's live
 * on-chain balance: there is no new on-chain "position id" to attribute a
 * shared pool balance back to one specific strategy (this feature
 * introduces no new contract), so the aggregated *display* figures here are
 * a projection of what this strategy itself opened. Live risk MONITORING
 * for the deleveraging guard (Scope §6) reads actual on-chain health factor
 * separately in lib/coordinator/deleverageGuard.ts — this module is the
 * portfolio-display reducer, not the risk-control read path.
 */
export interface LeveragePositionSummary {
  strategyId: string;
  strategyName: string;
  assetCode: string;
  borrowAssetCode: string;
  /** Total collateral realized across every iteration + the final redeposit, in the asset's own units. */
  totalCollateralUnits: number;
  /** Total debt drawn across every iteration, in the borrow asset's own units. */
  totalDebtUnits: number;
  /** Weighted-average max LTV across the pools this loop actually used. */
  blendedCollateralFactorPct: number;
  /** Spot price adjusted for the loop's cumulative swap slippage. */
  blendedEntryPrice: number | null;
  effectiveLeverage: number | null;
  healthFactor: number | null;
  liquidationPrice: number | null;
  collateralValueUsd: number | null;
  debtValueUsd: number | null;
}

export function computeLeveragePositionSummary(
  strategyId: string,
  strategyName: string,
  meta: LeverageLoopStrategyMeta,
  getPrice: PriceLookup
): LeveragePositionSummary {
  const { assetCode, borrowAssetCode, route } = meta;
  const iterations = route.iterations;

  const totalDebtUnits = iterations.reduce(
    (sum, it) => sum + Number(it.borrowAmount),
    0
  );
  const finalRedeposit = iterations.length
    ? Number(iterations[iterations.length - 1].swapAmountOut)
    : 0;
  const initialDeposit = iterations.length
    ? Number(iterations[0].depositAmount)
    : 0;
  const totalCollateralUnits =
    initialDeposit +
    iterations.slice(1).reduce((sum, it) => sum + Number(it.depositAmount), 0) +
    finalRedeposit;

  const totalSlippageBps = iterations.reduce(
    (sum, it) => sum + it.swapPriceImpactBps,
    0
  );

  const totalBorrowWeight = iterations.reduce(
    (sum, it) => sum + Number(it.borrowAmount),
    0
  );
  const blendedCollateralFactorPct =
    totalBorrowWeight > 0
      ? iterations.reduce((sum, it) => {
          const pool = route.poolsUsed.find(
            (p) => p.borrowPoolId === it.borrowPoolId
          );
          return (
            sum +
            (pool?.maxLtvPct ?? 0) *
              (Number(it.borrowAmount) / totalBorrowWeight)
          );
        }, 0)
      : (route.poolsUsed[0]?.maxLtvPct ?? 0);

  const collateralPrice = getPrice(assetCode);
  const debtPrice = getPrice(borrowAssetCode);
  const blendedEntryPrice =
    collateralPrice != null
      ? collateralPrice * (1 + totalSlippageBps / 10_000)
      : null;

  const collateralValueUsd =
    collateralPrice != null ? totalCollateralUnits * collateralPrice : null;
  const debtValueUsd = debtPrice != null ? totalDebtUnits * debtPrice : null;

  const healthFactor =
    collateralValueUsd != null && debtValueUsd != null
      ? calculateProjectedHealthFactor(
          collateralValueUsd,
          debtValueUsd,
          blendedCollateralFactorPct
        )
      : null;

  const liquidationPrice =
    debtValueUsd != null
      ? calculateLiquidationPrice(
          totalCollateralUnits,
          debtValueUsd,
          blendedCollateralFactorPct
        )
      : null;

  const effectiveLeverage =
    collateralValueUsd != null &&
    debtValueUsd != null &&
    collateralValueUsd - debtValueUsd > 0
      ? collateralValueUsd / (collateralValueUsd - debtValueUsd)
      : null;

  return {
    strategyId,
    strategyName,
    assetCode,
    borrowAssetCode,
    totalCollateralUnits,
    totalDebtUnits,
    blendedCollateralFactorPct,
    blendedEntryPrice,
    effectiveLeverage,
    healthFactor,
    liquidationPrice,
    collateralValueUsd,
    debtValueUsd,
  };
}

// ─── Sourcing persisted leverage strategies ──────────────────────────────────

export interface LeverageStrategyEntry {
  id: string;
  name: string;
  meta: LeverageLoopStrategyMeta;
}

function loadLeverageStrategies(
  walletAddress: string
): LeverageStrategyEntry[] {
  return listStrategies(walletAddress)
    .filter(
      (s): s is Strategy & { leverageMeta: LeverageLoopStrategyMeta } =>
        s.leverageMeta?.kind === "leverage-loop"
    )
    .map((s) => ({ id: s.id, name: s.name, meta: s.leverageMeta }));
}

/**
 * Sources every persisted leverage-loop strategy (Scope §3's storage
 * extension) for the connected wallet, ahead of reduction by
 * computeLeveragePositionSummary above — the only consumer of both is
 * useUnifiedPositions, so sourcing and reducing live together in one file.
 * Mirrors the synchronous-load + rehydrate-on-wallet-change pattern already
 * used by features/borrowing/hooks/useRiskThresholds — strategy persistence
 * is a plain localStorage read, not a query, so there's nothing to fetch.
 */
export function useLeverageStrategies(walletAddress: string | undefined): {
  strategies: LeverageStrategyEntry[];
} {
  const [strategies, setStrategies] = useState<LeverageStrategyEntry[]>(() =>
    walletAddress ? loadLeverageStrategies(walletAddress) : []
  );

  const [loadedWallet, setLoadedWallet] = useState(walletAddress);
  if (loadedWallet !== walletAddress) {
    setLoadedWallet(walletAddress);
    setStrategies(walletAddress ? loadLeverageStrategies(walletAddress) : []);
  }

  return useMemo(() => ({ strategies }), [strategies]);
}
