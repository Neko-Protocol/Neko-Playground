import type {
  LoopIterationPlan,
  LoopSizingInput,
  LoopSizingResult,
} from "./types";

/**
 * Safety rail against a pathological input (e.g. safety buffer within
 * floating-point epsilon of the max LTV) looping effectively forever.
 * Chosen well above any realistic route — real RWA lending LTVs on this
 * app top out well under 90%, which converges in single digits of
 * iterations for any sane target multiple.
 */
export const LEVERAGE_LOOP_MAX_ITERATIONS = 25;

/** Below this, two multiples are treated as equal — avoids float-epsilon false rejections/loops. */
const MULTIPLE_EPSILON = 1e-6;

function toNum(amount: string): number {
  const n = Number(amount);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Computes the number of deposit→borrow→swap→redeposit iterations needed to
 * reach `targetMultiple`, and the amount per iteration, for a single pool's
 * max LTV honoring a safety buffer below it.
 *
 * Pure geometric-series sizing: each iteration borrows
 * `effectiveLtv * depositAmount` and (assuming the swap leg returns the
 * borrowed value 1:1 in the same asset — routing.ts is what layers real
 * swap-quote slippage on top of this) redeposits that as the next
 * iteration's collateral. The series converges to
 * `1 / (1 - effectiveLtv)` as iterations → ∞, which is the maximum
 * multiple ANY loop on this route can reach no matter how many iterations
 * run — targets beyond it are rejected outright rather than looping
 * forever chasing an unreachable ratio.
 */
export function computeLeverageLoop(input: LoopSizingInput): LoopSizingResult {
  const {
    assetCode,
    initialCollateralAmount,
    targetMultiple,
    maxLtvPct,
    safetyBufferPct,
    maxLiquidityPerIteration,
    maxIterations = LEVERAGE_LOOP_MAX_ITERATIONS,
  } = input;

  if (!Number.isFinite(maxLtvPct) || maxLtvPct <= 0 || maxLtvPct >= 100) {
    return {
      ok: false,
      reasonCode: "INVALID_MAX_LTV",
      reason: `Pool max LTV (${maxLtvPct}%) must be between 0 and 100.`,
    };
  }

  if (!Number.isFinite(safetyBufferPct) || safetyBufferPct < 0) {
    return {
      ok: false,
      reasonCode: "INVALID_SAFETY_BUFFER",
      reason: `Safety buffer (${safetyBufferPct}%) must be zero or a positive percentage.`,
    };
  }

  if (!Number.isFinite(targetMultiple) || targetMultiple <= 1) {
    return {
      ok: false,
      reasonCode: "INVALID_TARGET_MULTIPLE",
      reason: `Target multiple (${targetMultiple}x) must be greater than 1x — a loop only amplifies exposure above the initial deposit.`,
    };
  }

  const effectiveLtvPct = maxLtvPct - safetyBufferPct;
  if (effectiveLtvPct <= 0) {
    return {
      ok: false,
      reasonCode: "INVALID_SAFETY_BUFFER",
      reason: `Safety buffer (${safetyBufferPct}%) leaves no usable LTV headroom against the pool's max LTV (${maxLtvPct}%).`,
    };
  }

  const effectiveLtv = effectiveLtvPct / 100;
  // Sum of an infinite geometric series with ratio effectiveLtv < 1: the
  // theoretical ceiling this route can ever reach, regardless of iteration count.
  const maxAchievableMultiple = 1 / (1 - effectiveLtv);

  if (targetMultiple > maxAchievableMultiple + MULTIPLE_EPSILON) {
    return {
      ok: false,
      reasonCode: "UNREACHABLE_TARGET_MULTIPLE",
      reason:
        `Target multiple ${targetMultiple.toFixed(2)}x is unreachable at an effective LTV of ` +
        `${effectiveLtvPct.toFixed(2)}% (max LTV ${maxLtvPct}% minus ${safetyBufferPct}% safety buffer) — ` +
        `the highest multiple this route can reach, even with unlimited iterations, is ${maxAchievableMultiple.toFixed(2)}x.`,
    };
  }

  const initial = toNum(initialCollateralAmount);
  const liquidityCap =
    maxLiquidityPerIteration != null ? toNum(maxLiquidityPerIteration) : null;

  const iterations: LoopIterationPlan[] = [];
  let cumulativeCollateral = initial;
  let cumulativeDebt = 0;
  let depositAmount = initial;

  for (let i = 1; i <= maxIterations; i++) {
    const borrowAmount = depositAmount * effectiveLtv;

    if (liquidityCap != null && borrowAmount > liquidityCap) {
      return {
        ok: false,
        reasonCode: "INSUFFICIENT_ROUTE_LIQUIDITY",
        reason:
          `Iteration ${i} would need to borrow ${borrowAmount.toFixed(7)} ${assetCode}, exceeding the ` +
          `route's available liquidity of ${liquidityCap.toFixed(7)} ${assetCode} for this leg.`,
        partialIterations: iterations,
      };
    }

    cumulativeDebt += borrowAmount;
    cumulativeCollateral += borrowAmount; // swap leg assumed 1:1 at this layer
    const multipleAtStep = cumulativeCollateral / initial;

    iterations.push({
      index: i,
      depositAmount: depositAmount.toFixed(7),
      borrowAmount: borrowAmount.toFixed(7),
      cumulativeCollateral: cumulativeCollateral.toFixed(7),
      cumulativeDebt: cumulativeDebt.toFixed(7),
      multipleAtStep,
    });

    if (multipleAtStep >= targetMultiple - MULTIPLE_EPSILON) {
      return {
        ok: true,
        assetCode,
        initialCollateralAmount: initialCollateralAmount,
        targetMultiple,
        achievedMultiple: multipleAtStep,
        effectiveLtvPct,
        iterations,
        totalCollateral: cumulativeCollateral.toFixed(7),
        totalDebt: cumulativeDebt.toFixed(7),
      };
    }

    // Next iteration's deposit is this iteration's borrowed-then-swapped amount.
    depositAmount = borrowAmount;
  }

  return {
    ok: false,
    reasonCode: "MAX_ITERATIONS_EXCEEDED",
    reason:
      `Target multiple ${targetMultiple.toFixed(2)}x was not reached within the ${maxIterations}-iteration safety cap ` +
      `(reached ${(cumulativeCollateral / initial).toFixed(2)}x). This should only happen extremely close to the ` +
      `route's theoretical ceiling — try a lower target multiple or a larger safety buffer.`,
    partialIterations: iterations,
  };
}
