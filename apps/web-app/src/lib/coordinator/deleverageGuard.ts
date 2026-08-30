import { calculateProjectedHealthFactor } from "@/features/borrowing/utils/liquidationPrice";
import { isDelegationUsable } from "./delegation";
import type { DelegationGrant } from "./types";

/**
 * Automated deleveraging guard (Scope §6) — watches a leveraged position
 * against a user-configured threshold STRICTER than, and distinct from,
 * features/borrowing/hooks/useRiskAlerts' notify-only threshold, and
 * triggers a bounded automated unwind through the coordinator on breach.
 * Reuses the same projected-health-factor formula as
 * features/borrowing/utils/liquidationPrice.ts (HF = collateral*CF / debt)
 * — inverted here to solve for how much debt relief clears a target HF.
 */

export interface PositionRiskSnapshot {
  healthFactor: number | null;
  collateralValueUsd: number | null;
  debtValueUsd: number | null;
  blendedCollateralFactorPct: number;
  debtAssetPriceUsd: number | null;
}

export interface DeleverageGuardConfig {
  /** Automated-unwind threshold. Must be validated stricter (lower) than the position's notify-only useRiskAlerts threshold by the caller. */
  deleverageThreshold: number;
  /** Recovery margin — mirrors HF_ALERT_HYSTERESIS's role in useRiskAlerts, preventing the guard from re-triggering while HF oscillates around the boundary. */
  hysteresis: number;
}

export type GuardAction =
  | { kind: "hold" }
  | { kind: "recovered" }
  | { kind: "alert-only"; reason: string }
  | {
      kind: "trigger-unwind";
      requiredDebtReliefUnits: number;
      targetHealthFactor: number;
    };

/**
 * Inverts HF = (collateral * CF) / debt to solve for how much debt (in USD)
 * must be repaid — funded by withdrawing collateral in the SAME ratio the
 * loop itself was built at (debt_i = deposit_i * effectiveLtv, so
 * effectiveLtv ≈ CF here) — to bring health factor up to
 * `targetHealthFactor`. This is an ESTIMATE sized from blended portfolio
 * figures, not the exact outcome of whichever discrete tranches get picked
 * (see lib/coordinator/delegation.ts's selectTranchesToClearBreach) — the
 * guard re-evaluates on every tick and stops once actually recovered, so an
 * imperfect estimate self-corrects rather than needing to be exact in one
 * shot.
 */
export function computeRequiredDebtReliefUsd(
  collateralValueUsd: number,
  debtValueUsd: number,
  collateralFactorPct: number,
  targetHealthFactor: number
): number {
  const cf = collateralFactorPct / 100;
  if (cf <= 0 || debtValueUsd <= 0) return 0;
  const denominator = targetHealthFactor - 1;
  if (denominator <= 0) return 0; // target must exceed 1.0 (HF=1.0 is the liquidation boundary itself) for a finite solution
  const raw =
    (targetHealthFactor * debtValueUsd - collateralValueUsd * cf) / denominator;
  return Math.max(0, Math.min(raw, debtValueUsd));
}

export function shouldTriggerUnwind(
  healthFactor: number | null,
  threshold: number
): boolean {
  return healthFactor != null && healthFactor < threshold;
}

export function hasRecovered(
  healthFactor: number | null,
  threshold: number,
  hysteresis: number
): boolean {
  return healthFactor != null && healthFactor >= threshold + hysteresis;
}

/**
 * The guard's single decision function for one position on one tick.
 * `wasBreached` is the guard's own persisted breach flag for this position
 * (mirrors useRiskAlerts' BreachStateMap) — held through the hysteresis
 * band so the guard doesn't fire again the instant HF ticks a hair above
 * the raw threshold, only once it clears threshold + hysteresis.
 */
export function evaluatePosition(
  snapshot: PositionRiskSnapshot,
  grant: DelegationGrant | null,
  wasBreached: boolean,
  config: DeleverageGuardConfig,
  now: number = Date.now()
): GuardAction {
  if (snapshot.healthFactor == null) return { kind: "hold" };

  const target = config.deleverageThreshold + config.hysteresis;

  if (
    wasBreached &&
    hasRecovered(
      snapshot.healthFactor,
      config.deleverageThreshold,
      config.hysteresis
    )
  ) {
    return { kind: "recovered" };
  }

  if (!shouldTriggerUnwind(snapshot.healthFactor, config.deleverageThreshold)) {
    return { kind: "hold" };
  }

  // Breached. Falls back to alert-only — never blocks the breach from being
  // reported — whenever there's no usable delegation to act within.
  if (!isDelegationUsable(grant, now)) {
    return {
      kind: "alert-only",
      reason:
        grant == null
          ? "No delegation has been granted for this position."
          : grant.status === "revoked"
            ? "Delegation was revoked."
            : "Delegation has expired.",
    };
  }

  if (
    snapshot.collateralValueUsd == null ||
    snapshot.debtValueUsd == null ||
    snapshot.debtAssetPriceUsd == null ||
    snapshot.debtAssetPriceUsd <= 0
  ) {
    return {
      kind: "alert-only",
      reason: "Live price data is unavailable to size an automated unwind.",
    };
  }

  const requiredUsd = computeRequiredDebtReliefUsd(
    snapshot.collateralValueUsd,
    snapshot.debtValueUsd,
    snapshot.blendedCollateralFactorPct,
    target
  );
  const requiredDebtReliefUnits = requiredUsd / snapshot.debtAssetPriceUsd;

  if (requiredDebtReliefUnits <= 0) return { kind: "hold" };

  return {
    kind: "trigger-unwind",
    requiredDebtReliefUnits,
    targetHealthFactor: target,
  };
}

// ─── Live risk read ───────────────────────────────────────────────────────────

/**
 * Reads one pool's live on-chain position for a wallet, in the pool's own
 * decimal units — injected so this module stays adapter/SDK-free (mirrors
 * lib/strategy/execution.ts's transport injection). The real implementation
 * (app/api/leverage/guard/route.ts) wires BlendPoolAdapter/
 * NekoLendingAdapter.getUserPosition; tests inject a fixed map.
 *
 * Returns null when the pool can't be read (unsupported protocol surface,
 * transient RPC error) rather than throwing — a single unreadable pool
 * degrades the snapshot instead of crashing the whole guard tick.
 */
export type PoolPositionReader = (
  poolId: string,
  walletAddress: string
) => Promise<{ collateralUnits: number; debtUnits: number } | null>;

export type PriceReader = (assetCode: string) => number | null;

/**
 * Aggregates a grant's UNCONSUMED tranches' pools into one live
 * PositionRiskSnapshot evaluatePosition() can consume. Deliberately reads
 * only the unconsumed portion — a tranche the coordinator already unwound
 * no longer represents live exposure this grant is responsible for.
 */
export async function computeGrantRiskSnapshot(
  grant: DelegationGrant,
  readPoolPosition: PoolPositionReader,
  getPrice: PriceReader
): Promise<PositionRiskSnapshot> {
  const unconsumed = grant.tranches.filter(
    (t) => !grant.consumedTrancheIds.includes(t.id)
  );

  if (unconsumed.length === 0) {
    return {
      healthFactor: null,
      collateralValueUsd: null,
      debtValueUsd: null,
      blendedCollateralFactorPct: 0,
      debtAssetPriceUsd: getPrice(grant.borrowAssetCode),
    };
  }

  const collateralPoolIds = [
    ...new Set(unconsumed.map((t) => t.collateralPoolId)),
  ];
  const borrowPoolIds = [...new Set(unconsumed.map((t) => t.borrowPoolId))];

  // Collateral: an unreadable pool falls back to zero. That undercounts the
  // numerator of HF = (collateral*CF)/debt, which only ever makes the
  // computed HF LOWER than reality — the conservative, safe-to-be-wrong-in
  // direction for a risk control (the guard can only trigger too early,
  // never too late, from this specific gap).
  let totalCollateralUnits = 0;
  for (const poolId of collateralPoolIds) {
    const position = await readPoolPosition(poolId, grant.walletAddress);
    if (position) totalCollateralUnits += position.collateralUnits;
  }

  // Debt: the OPPOSITE bias would be dangerous here — silently treating an
  // unreadable debt pool as zero would make HF look BETTER than reality
  // (the denominator undercounted) and could suppress a real breach. When a
  // debt read is unavailable (a protocol whose adapter doesn't expose one —
  // see app/api/leverage/guard/route.ts's readPoolPosition for Neko), fall
  // back to that pool's affected tranches' own known-safe static open-time
  // debtAmount rather than assuming the debt vanished.
  let totalDebtUnits = 0;
  for (const poolId of borrowPoolIds) {
    const position = await readPoolPosition(poolId, grant.walletAddress);
    if (position) {
      totalDebtUnits += position.debtUnits;
    } else {
      totalDebtUnits += unconsumed
        .filter((t) => t.borrowPoolId === poolId)
        .reduce((sum, t) => sum + Number(t.debtAmount), 0);
    }
  }

  // Weighted by each tranche's original debt share — the same blending
  // approach features/dashboard/positions/leverage.ts uses for display.
  const totalWeight = unconsumed.reduce(
    (sum, t) => sum + Number(t.debtAmount),
    0
  );

  const collateralPrice = getPrice(grant.assetCode);
  const debtPrice = getPrice(grant.borrowAssetCode);
  const collateralValueUsd =
    collateralPrice != null ? totalCollateralUnits * collateralPrice : null;
  const debtValueUsd = debtPrice != null ? totalDebtUnits * debtPrice : null;

  // A DelegationTrancheRecord carries only its own collateral/debt amounts,
  // not the pool's max LTV directly, so the pool's real collateral factor
  // isn't independently observable from these generic pool-position reads.
  // Approximate it from the EFFECTIVE LTV the loop was actually built at
  // (debtAmount / collateralAmount per tranche, debt-weighted across
  // tranches) — by construction (lib/strategy/leverage/loopSizing.ts) that
  // effective LTV is maxLtv minus the user's safety buffer, i.e. always
  // slightly BELOW the real collateral factor. That makes this a
  // deliberately conservative proxy: the computed health factor comes out
  // slightly lower than the true one, so the guard can only trigger
  // earlier than strictly necessary, never later.
  const blendedCollateralFactorPct =
    totalWeight > 0
      ? unconsumed.reduce((sum, t) => {
          const effectiveLtvPct =
            Number(t.collateralAmount) > 0
              ? (Number(t.debtAmount) / Number(t.collateralAmount)) * 100
              : 0;
          return sum + effectiveLtvPct * (Number(t.debtAmount) / totalWeight);
        }, 0)
      : 0;

  const healthFactor =
    collateralValueUsd != null && debtValueUsd != null
      ? calculateProjectedHealthFactor(
          collateralValueUsd,
          debtValueUsd,
          blendedCollateralFactorPct
        )
      : null;

  return {
    healthFactor,
    collateralValueUsd,
    debtValueUsd,
    blendedCollateralFactorPct,
    debtAssetPriceUsd: debtPrice,
  };
}
