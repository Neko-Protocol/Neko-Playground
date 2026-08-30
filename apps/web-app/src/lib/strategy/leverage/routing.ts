import { computeLeverageLoop } from "./loopSizing";
import type { PoolInfo } from "@/lib/orchestrator/types/pool.types";
import type {
  RouteCandidatePool,
  RouteIterationAssignment,
  RouteResult,
  RouteSimulation,
  RouteSimulationStep,
  SwapQuoteFn,
} from "./types";

/**
 * Neko's collateral pool doesn't expose a per-reserve collateral factor the
 * way Blend does (see BlendPoolAdapter's metadata.cFactor) — its contract
 * enforces LTV internally without surfacing it through PoolInfo. Documented
 * fallback, consistent with lib/strategy/engine.ts's
 * DEFAULT_COLLATERAL_FACTOR_PCT used for the same reason.
 */
export const DEFAULT_NEKO_MAX_LTV_PCT = 75;

function blendPoolContractId(poolInfoId: string): string | null {
  if (!poolInfoId.startsWith("blend:")) return null;
  return poolInfoId.split(":")[1] ?? null;
}

/**
 * Pairs orchestrator PoolInfo entries into routing candidates. A leverage
 * loop always deposits the same collateral asset and borrows the same debt
 * asset every iteration, so a "route" is really a (collateral reserve,
 * borrow reserve) pair, not a single pool:
 *  - Blend pools are shared-liquidity multi-asset pools — the collateral
 *    and debt reserves are two different PoolInfo entries that must share
 *    the same underlying pool contract for one deposit to back one borrow.
 *  - Neko is two fixed single-asset pools (RWA collateral in pool2, USDC/XLM
 *    debt in pool1) — every RWA collateralPools entry pairs with every
 *    borrowPools entry, since the two contracts are wired together for all
 *    assets the same way.
 *
 * `maxLtvPct` comes from the COLLATERAL reserve's own collateral factor —
 * borrowRatePct/availableLiquidity come from the BORROW reserve, since
 * that's the leg being minimized/liquidity-checked when routing.
 */
export function deriveRouteCandidates(
  collateralPools: PoolInfo[],
  borrowPools: PoolInfo[]
): RouteCandidatePool[] {
  const eligibleCollateral = collateralPools.filter(
    (p) =>
      p.supportedActions.includes("supplyCollateral") && p.state === "active"
  );
  const eligibleBorrow = borrowPools.filter(
    (p) => p.supportedActions.includes("borrow") && p.state === "active"
  );

  const candidates: RouteCandidatePool[] = [];

  for (const collateral of eligibleCollateral) {
    const collateralContract = blendPoolContractId(collateral.id);
    for (const borrow of eligibleBorrow) {
      if (collateral.type !== borrow.type) continue;
      if (collateral.type === "blend") {
        // Same pool contract required — Blend borrowing power is computed
        // per-pool from every reserve deposited within that same contract.
        if (blendPoolContractId(borrow.id) !== collateralContract) continue;
      }

      const cFactor = collateral.metadata.cFactor;
      const maxLtvPct =
        typeof cFactor === "number" && cFactor > 0 && cFactor <= 1
          ? cFactor * 100
          : DEFAULT_NEKO_MAX_LTV_PCT;
      const borrowApy = borrow.metadata.borrowApy;
      const borrowRatePct =
        typeof borrowApy === "number" ? borrowApy : Number.POSITIVE_INFINITY;

      candidates.push({
        poolType: collateral.type,
        collateralPoolId: collateral.id,
        borrowPoolId: borrow.id,
        maxLtvPct,
        borrowRatePct,
        availableLiquidity: (Number(borrow.tvl) / 10 ** 7).toFixed(7),
      });
    }
  }

  return candidates;
}

export interface SelectRouteInput {
  /** RWA asset supplied as collateral and reacquired via the swap-back leg. */
  assetCode: string;
  /** Asset borrowed against the collateral (e.g. USDC). */
  borrowAssetCode: string;
  initialCollateralAmount: string;
  targetMultiple: number;
  safetyBufferPct: number;
  candidates: RouteCandidatePool[];
  getSwapQuote: SwapQuoteFn;
  maxIterations?: number;
  /** Optional spot USD price for assetCode, used only to express blendedEntryPrice. */
  priceUsd?: number | null;
}

function weightedAverage(
  values: { weight: number; value: number }[]
): number | null {
  const totalWeight = values.reduce((sum, v) => sum + v.weight, 0);
  if (totalWeight <= 0) return null;
  return values.reduce((sum, v) => sum + v.weight * v.value, 0) / totalWeight;
}

/**
 * Selects the lowest blended-cost route for a recursive leverage loop across
 * every eligible registered pool, and produces a full pre-trade simulation
 * (Scope §2). Unlike loopSizing.computeLeverageLoop (which assumes a
 * 1:1 swap-back to size the theoretical loop against a single pool's LTV),
 * this walks the loop iteration-by-iteration against LIVE swap quotes and a
 * per-pool liquidity budget, greedily picking the cheapest pool with enough
 * remaining liquidity at each step — which is what naturally produces a
 * cross-protocol route when the cheapest pool runs out of room mid-loop.
 */
export async function selectRoute(
  input: SelectRouteInput
): Promise<RouteResult> {
  const {
    assetCode,
    borrowAssetCode,
    initialCollateralAmount,
    targetMultiple,
    safetyBufferPct,
    candidates,
    getSwapQuote,
    maxIterations,
    priceUsd,
  } = input;

  const eligible = candidates.filter((c) => c.maxLtvPct - safetyBufferPct > 0);
  if (eligible.length === 0) {
    return {
      ok: false,
      reasonCode: "NO_SUPPORTED_POOL",
      reason: `No registered pool supports leveraging ${assetCode} with a positive LTV after the ${safetyBufferPct}% safety buffer.`,
    };
  }

  // Reachability gate: if even the single most permissive pool (ignoring
  // liquidity and swap slippage) can't reach the target multiple, no
  // combination of pools can either — fail fast with the same rejection
  // vocabulary as the standalone sizing calculator.
  const bestLtvCandidate = eligible.reduce((best, c) =>
    c.maxLtvPct > best.maxLtvPct ? c : best
  );
  const reachability = computeLeverageLoop({
    assetCode,
    initialCollateralAmount,
    targetMultiple,
    maxLtvPct: bestLtvCandidate.maxLtvPct,
    safetyBufferPct,
    maxIterations,
  });
  if (!reachability.ok) {
    return {
      ok: false,
      reasonCode: reachability.reasonCode,
      reason: `No available route can reach the target multiple: ${reachability.reason}`,
    };
  }

  const remainingLiquidity = new Map(
    eligible.map((c) => [c.borrowPoolId, Number(c.availableLiquidity)])
  );

  const iterations: RouteIterationAssignment[] = [];
  const initial = Number(initialCollateralAmount);
  let depositAmount = initial;
  let cumulativeCollateral = initial;
  const cap = maxIterations ?? 25;

  for (let i = 1; i <= cap; i++) {
    const ranked = [...eligible].sort(
      (a, b) => a.borrowRatePct - b.borrowRatePct
    );
    const chosen = ranked.find((c) => {
      const effectiveLtv = (c.maxLtvPct - safetyBufferPct) / 100;
      const borrowAmount = depositAmount * effectiveLtv;
      return (remainingLiquidity.get(c.borrowPoolId) ?? 0) >= borrowAmount;
    });

    if (!chosen) {
      return {
        ok: false,
        reasonCode: "INSUFFICIENT_ROUTE_LIQUIDITY",
        reason: `Iteration ${i} needs more ${borrowAssetCode} liquidity than any eligible pool has remaining after prior iterations' borrows.`,
      };
    }

    const effectiveLtv = (chosen.maxLtvPct - safetyBufferPct) / 100;
    const borrowAmount = depositAmount * effectiveLtv;
    remainingLiquidity.set(
      chosen.borrowPoolId,
      (remainingLiquidity.get(chosen.borrowPoolId) ?? 0) - borrowAmount
    );

    const quote = await getSwapQuote({
      tokenIn: borrowAssetCode,
      tokenOut: assetCode,
      amountIn: borrowAmount.toFixed(7),
    });
    if (!quote) {
      return {
        ok: false,
        reasonCode: "NO_SUPPORTED_POOL",
        reason: `No swap liquidity found for ${borrowAssetCode} -> ${assetCode} to close iteration ${i}'s loop.`,
      };
    }

    const swapAmountOut = Number(quote.amountOut);
    iterations.push({
      index: i,
      poolType: chosen.poolType,
      collateralPoolId: chosen.collateralPoolId,
      borrowPoolId: chosen.borrowPoolId,
      depositAmount: depositAmount.toFixed(7),
      borrowAmount: borrowAmount.toFixed(7),
      swapAmountOut: swapAmountOut.toFixed(7),
      swapPriceImpactBps: quote.priceImpactBps,
    });

    cumulativeCollateral += swapAmountOut;
    const multipleAtStep = cumulativeCollateral / initial;
    depositAmount = swapAmountOut;

    if (multipleAtStep >= targetMultiple - 1e-6) {
      const steps: RouteSimulationStep[] = iterations.flatMap((it) => [
        {
          kind: "deposit" as const,
          iterationIndex: it.index,
          poolId: it.collateralPoolId,
          assetCode,
          amount: it.depositAmount,
        },
        {
          kind: "borrow" as const,
          iterationIndex: it.index,
          poolId: it.borrowPoolId,
          assetCode: borrowAssetCode,
          amount: it.borrowAmount,
        },
        {
          kind: "swap" as const,
          iterationIndex: it.index,
          assetCode,
          amount: it.swapAmountOut,
          priceImpactBps: it.swapPriceImpactBps,
        },
      ]);

      const totalSlippageBps = iterations.reduce(
        (sum, it) => sum + it.swapPriceImpactBps,
        0
      );
      const totalBorrowCostPct =
        weightedAverage(
          iterations.map((it) => {
            const pool = eligible.find(
              (c) => c.borrowPoolId === it.borrowPoolId
            );
            return {
              weight: Number(it.borrowAmount),
              value: pool?.borrowRatePct ?? 0,
            };
          })
        ) ?? 0;

      const simulation: RouteSimulation = {
        steps,
        blendedEntryPrice:
          priceUsd != null ? priceUsd * (1 + totalSlippageBps / 10_000) : null,
        totalBorrowCostPct,
        totalSlippageBps,
      };

      const poolsUsed: RouteCandidatePool[] = [];
      const seen = new Set<string>();
      for (const it of iterations) {
        if (seen.has(it.borrowPoolId)) continue;
        seen.add(it.borrowPoolId);
        const pool = eligible.find((c) => c.borrowPoolId === it.borrowPoolId);
        if (pool) poolsUsed.push(pool);
      }

      return { ok: true, assetCode, iterations, simulation, poolsUsed };
    }
  }

  return {
    ok: false,
    reasonCode: "MAX_ITERATIONS_EXCEEDED",
    reason: `Target multiple ${targetMultiple.toFixed(2)}x was not reached within ${cap} iterations once live swap slippage was accounted for — try a lower target multiple.`,
  };
}
