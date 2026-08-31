import type { PoolType } from "@/lib/orchestrator/types/pool.types";

/**
 * Leverage-loop domain types (issue: recursive leverage on RWA collateral).
 *
 * Kept separate from lib/strategy/types.ts's generic StrategyStep model —
 * this module computes *how many* deposit→borrow→swap→redeposit iterations
 * a target multiple needs and *which pools/swap paths* to route them
 * through; lib/strategy/leverage/buildStrategy.ts is the only place that
 * turns the result into StrategyStep[] for the existing engine to run.
 */

// ─── Loop sizing (Scope §1) ──────────────────────────────────────────────────

export interface LoopSizingInput {
  /** RWA asset code being leveraged (e.g. "USTRY"). */
  assetCode: string;
  /** Starting collateral, in the asset's own decimal units (not USD). */
  initialCollateralAmount: string;
  /** Desired total collateral / initial collateral ratio, e.g. 3 for 3x. */
  targetMultiple: number;
  /** Pool's max loan-to-value, as a percentage (e.g. 75 for 75%). */
  maxLtvPct: number;
  /** User-configured safety margin subtracted from maxLtvPct, in percentage points. */
  safetyBufferPct: number;
  /**
   * Upper bound on borrow-then-swap size the chosen route can absorb per
   * iteration, in the asset's own units. Omit to skip the liquidity check
   * (used by the pure sizing calculator in isolation; routing.ts always
   * supplies it from live PoolInfo.tvl / quote depth).
   */
  maxLiquidityPerIteration?: string;
  /** Safety rail against runaway loops — default LEVERAGE_LOOP_MAX_ITERATIONS. */
  maxIterations?: number;
}

export interface LoopIterationPlan {
  /** 1-based iteration number. */
  index: number;
  /** Collateral this iteration deposits, before borrowing against it. */
  depositAmount: string;
  /** Amount borrowed against depositAmount at the effective LTV. */
  borrowAmount: string;
  /** Running total collateral posted so far, after this iteration's deposit. */
  cumulativeCollateral: string;
  /** Running total debt so far, after this iteration's borrow. */
  cumulativeDebt: string;
  /** cumulativeCollateral / initialCollateralAmount at this point in the loop. */
  multipleAtStep: number;
}

export interface LoopSizingPlan {
  ok: true;
  assetCode: string;
  initialCollateralAmount: string;
  targetMultiple: number;
  achievedMultiple: number;
  effectiveLtvPct: number;
  iterations: LoopIterationPlan[];
  totalCollateral: string;
  totalDebt: string;
}

export type LoopRejectionReasonCode =
  | "UNREACHABLE_TARGET_MULTIPLE"
  | "INVALID_SAFETY_BUFFER"
  | "INVALID_TARGET_MULTIPLE"
  | "INVALID_MAX_LTV"
  | "INSUFFICIENT_ROUTE_LIQUIDITY"
  | "MAX_ITERATIONS_EXCEEDED";

export interface LoopSizingRejection {
  ok: false;
  reasonCode: LoopRejectionReasonCode;
  reason: string;
  /** How far the loop got before rejecting, for UI diagnostics. */
  partialIterations?: LoopIterationPlan[];
}

export type LoopSizingResult = LoopSizingPlan | LoopSizingRejection;

// ─── Multi-pool routing (Scope §2) ───────────────────────────────────────────

export interface RouteCandidatePool {
  poolType: PoolType;
  /**
   * PoolInfo.id for the COLLATERAL leg — where the RWA asset is deposited.
   * For Blend this is one specific reserve; for Neko it's always the
   * shared RWA collateral pool (pool2).
   */
  collateralPoolId: string;
  /**
   * PoolInfo.id for the BORROW leg — where the debt asset is drawn from.
   * For Blend, the sibling reserve inside the SAME pool contract as
   * collateralPoolId (Blend pools are shared-liquidity multi-asset pools,
   * so collateral and debt reserves live together); for Neko, always the
   * fixed USDC/XLM pool (pool1) — a different contract than pool2.
   */
  borrowPoolId: string;
  /** Max LTV the collateral reserve offers, as a percentage. */
  maxLtvPct: number;
  /** Borrow APY/rate on the debt reserve, as a percentage — minimized when routing. */
  borrowRatePct: number;
  /** Available liquidity for the borrow leg, in the borrow asset's own units. */
  availableLiquidity: string;
}

export interface SwapQuoteFn {
  (input: {
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
  }): Promise<{ amountOut: string; priceImpactBps: number } | null>;
}

export interface RouteIterationAssignment {
  index: number;
  poolType: PoolType;
  collateralPoolId: string;
  borrowPoolId: string;
  depositAmount: string;
  borrowAmount: string;
  /** The swap step converting the borrowed asset back into more collateral. */
  swapAmountOut: string;
  swapPriceImpactBps: number;
}

export interface RouteSimulationStep {
  kind: "deposit" | "borrow" | "swap" | "redeposit";
  iterationIndex: number;
  poolId?: string;
  assetCode: string;
  amount: string;
  priceImpactBps?: number;
}

export interface RouteSimulation {
  steps: RouteSimulationStep[];
  /** Blended entry price for the position (collateral value / RWA units acquired). Null when unpriced. */
  blendedEntryPrice: number | null;
  /** Sum of borrow-rate cost across iterations, expressed as a blended annualized percentage. */
  totalBorrowCostPct: number;
  /** Cumulative swap slippage across every redeposit leg. */
  totalSlippageBps: number;
}

export interface RoutedLoopPlan {
  ok: true;
  assetCode: string;
  iterations: RouteIterationAssignment[];
  simulation: RouteSimulation;
  /** Pools touched by this route, in the order first used. */
  poolsUsed: RouteCandidatePool[];
}

export type RouteRejectionReasonCode =
  | "NO_SUPPORTED_POOL"
  | "INSUFFICIENT_ROUTE_LIQUIDITY"
  | LoopRejectionReasonCode;

export interface RouteRejection {
  ok: false;
  reasonCode: RouteRejectionReasonCode;
  reason: string;
}

export type RouteResult = RoutedLoopPlan | RouteRejection;

// ─── Strategy metadata persisted on the Strategy document (Scope §3) ────────

export interface LeverageLoopStrategyMeta {
  kind: "leverage-loop";
  assetCode: string;
  /** Debt asset borrowed each iteration (e.g. "USDC") — needed to price the debt leg independently of the collateral asset. */
  borrowAssetCode: string;
  targetMultiple: number;
  achievedMultiple: number;
  safetyBufferPct: number;
  route: {
    poolsUsed: RouteCandidatePool[];
    iterations: RouteIterationAssignment[];
  };
}
