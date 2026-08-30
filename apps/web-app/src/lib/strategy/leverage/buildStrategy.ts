import { nanoid } from "nanoid";
import { networks } from "@neko/lending";
import { getAvailableTokens } from "@/lib/helpers/stellar/soroswap";
import type { ParamBinding, Strategy, StrategyStep } from "../types";
import type {
  LeverageLoopStrategyMeta,
  RouteIterationAssignment,
  RoutedLoopPlan,
} from "./types";

const lit = (value: string): ParamBinding => ({ source: "literal", value });
const fromOutput = (stepId: string, portId: string): ParamBinding => ({
  source: "stepOutput",
  stepId,
  portId,
});

/**
 * Resolves a routing iteration's `collateralPoolId` (orchestrator PoolInfo
 * id, e.g. "blend:CPOOL...:CASSET..." or "neko:USTRY") into the literal
 * params the matching supply(mode=collateral) step definition expects. Kept
 * here rather than in routing.ts because it's execution wiring, not routing
 * decision-making.
 */
function collateralParams(
  collateralPoolId: string,
  assetCode: string
): Record<string, ParamBinding> {
  if (collateralPoolId.startsWith("blend:")) {
    const [, poolContractId, assetAddress] = collateralPoolId.split(":");
    return {
      poolContractId: lit(poolContractId),
      assetAddress: lit(assetAddress),
    };
  }
  // neko:<assetCode> — collateral always lands in pool2, mirroring
  // NekoLendingAdapter's own fixed routing.
  const tokenAddress = getAvailableTokens()[assetCode]?.contract ?? "";
  return {
    poolContractId: lit(networks.testnet.pool2ContractId),
    collateralTokenAddress: lit(tokenAddress),
  };
}

/**
 * Resolves a routing iteration's `borrowPoolId` into the literal params the
 * matching borrow/repay step definition expects.
 */
function borrowParams(
  borrowPoolId: string,
  assetCode: string,
  amount: string
): Record<string, ParamBinding> {
  if (borrowPoolId.startsWith("blend:")) {
    const [, poolContractId, assetAddress] = borrowPoolId.split(":");
    return {
      poolContractId: lit(poolContractId),
      assetAddress: lit(assetAddress),
      amount: lit(amount),
    };
  }
  // neko:<assetCode> — debt is always drawn from pool1; NekoLendingAdapter
  // resolves the contract internally from assetCode.
  return { assetCode: lit(assetCode), amount: lit(amount) };
}

export interface BuildOpenLoopStepsInput {
  route: RoutedLoopPlan;
  assetCode: string;
  borrowAssetCode: string;
  initialCollateralAmount: string;
}

/**
 * Turns a routed leverage loop into an ordered StrategyStep[] the EXISTING
 * lib/strategy/execution.ts engine can run wallet-present, step by step —
 * Scope §3's "no new execution primitive for this path". Each iteration
 * expands to supply(collateral) -> borrow -> swap, chained by dependsOn +
 * stepOutput bindings; a final supply(collateral) step redeposits the last
 * iteration's swap output, realizing the multiple the router simulated.
 */
export function buildOpenLoopSteps(
  input: BuildOpenLoopStepsInput
): StrategyStep[] {
  const { route, assetCode, borrowAssetCode, initialCollateralAmount } = input;
  const steps: StrategyStep[] = [];
  let previousSwapStepId: string | null = null;

  route.iterations.forEach((it: RouteIterationAssignment, idx: number) => {
    const supplyId = `leverage-supply-${it.index}`;
    const borrowId = `leverage-borrow-${it.index}`;
    const swapId = `leverage-swap-${it.index}`;
    const protocol = it.poolType === "blend" ? "blend" : "neko";

    steps.push({
      id: supplyId,
      type: "supply",
      protocol,
      label: `Deposit ${assetCode} collateral (iteration ${it.index})`,
      dependsOn: previousSwapStepId ? [previousSwapStepId] : [],
      params: {
        mode: lit("collateral"),
        direction: lit("deposit"),
        ...collateralParams(it.collateralPoolId, assetCode),
        amount: previousSwapStepId
          ? fromOutput(previousSwapStepId, "out.receivedAsset")
          : lit(idx === 0 ? initialCollateralAmount : it.depositAmount),
      },
    });

    steps.push({
      id: borrowId,
      type: "borrow",
      protocol,
      label: `Borrow ${borrowAssetCode} (iteration ${it.index})`,
      dependsOn: [supplyId],
      params: borrowParams(it.borrowPoolId, borrowAssetCode, it.borrowAmount),
    });

    steps.push({
      id: swapId,
      type: "swap",
      protocol: "soroswap",
      label: `Swap ${borrowAssetCode} -> ${assetCode} (iteration ${it.index})`,
      dependsOn: [borrowId],
      params: {
        // Asset CODES, not resolved contract addresses — matching every
        // other swap step in this codebase (lib/strategy/templates.ts's
        // built-in templates, lib/strategy/definitions.ts's own
        // validate()/knownAssetCode()). getQuote()/buildTransaction()
        // actually need addresses, which is a PRE-EXISTING mismatch in
        // swapSoroswapDefinition affecting every swap step, not something
        // specific to this feature — out of scope to patch here.
        tokenIn: lit(borrowAssetCode),
        tokenOut: lit(assetCode),
        amountIn: fromOutput(borrowId, "out.borrowedAsset"),
      },
    });

    previousSwapStepId = swapId;
  });

  if (previousSwapStepId) {
    const last = route.iterations[route.iterations.length - 1];
    const protocol = last.poolType === "blend" ? "blend" : "neko";
    steps.push({
      id: "leverage-redeposit-final",
      type: "supply",
      protocol,
      label: `Redeposit ${assetCode} collateral (final)`,
      dependsOn: [previousSwapStepId],
      params: {
        mode: lit("collateral"),
        direction: lit("deposit"),
        ...collateralParams(last.collateralPoolId, assetCode),
        amount: fromOutput(previousSwapStepId, "out.receivedAsset"),
      },
    });
  }

  return steps;
}

export function buildLeverageStrategyMeta(
  input: BuildOpenLoopStepsInput,
  targetMultiple: number,
  achievedMultiple: number,
  safetyBufferPct: number
): LeverageLoopStrategyMeta {
  return {
    kind: "leverage-loop",
    assetCode: input.route.assetCode,
    borrowAssetCode: input.borrowAssetCode,
    targetMultiple,
    achievedMultiple,
    safetyBufferPct,
    route: {
      poolsUsed: input.route.poolsUsed,
      iterations: input.route.iterations,
    },
  };
}

export function buildLeverageStrategy(
  input: BuildOpenLoopStepsInput,
  targetMultiple: number,
  achievedMultiple: number,
  safetyBufferPct: number,
  name = `Leverage ${input.assetCode} ${targetMultiple.toFixed(1)}x`
): Strategy {
  const now = Date.now();
  return {
    id: nanoid(),
    version: 1,
    name,
    description: `Recursive leverage loop on ${input.assetCode}, routed across ${input.route.poolsUsed.map((p) => p.poolType).join(", ")}.`,
    isTemplate: false,
    steps: buildOpenLoopSteps(input),
    createdAt: now,
    updatedAt: now,
    leverageMeta: buildLeverageStrategyMeta(
      input,
      targetMultiple,
      achievedMultiple,
      safetyBufferPct
    ),
  };
}

// ─── Unwind tranches (Scope §5 delegation payload) ───────────────────────────

export interface UnwindTranche {
  id: string;
  /** Deleverage order: 0 unwinds first (most recently added exposure). */
  order: number;
  /** USD-free estimate of how much collateral/debt this tranche clears, in the asset's own units. */
  collateralAmount: string;
  debtAmount: string;
  /** The pool this tranche's collateral/debt lives in — carried alongside the signed steps so a server-side reader (the guard) can look up live on-chain state without needing the client's localStorage-only Strategy record. */
  collateralPoolId: string;
  borrowPoolId: string;
  steps: StrategyStep[];
}

/**
 * Builds the pre-signed "circuit breaker" tranches the deleveraging guard
 * (Scope §6) is later allowed to submit through the coordinator (Scope §5),
 * reusing the exact same repay/supply(withdraw) step definitions the manual
 * Position Unwind template uses (lib/strategy/templates.ts's
 * "template-position-unwind") — no new execution primitive, no new
 * contract call. Each tranche repays BEFORE withdrawing, deliberately
 * mirroring that template's order: repaying first only ever improves
 * health factor and is safe to submit at any HF above 1.0, whereas
 * withdrawing collateral first — even collateral about to be backed by an
 * imminent repay — risks the pool's own on-chain LTV check rejecting the
 * withdrawal at exactly the moment (HF already low) the guard needs it to
 * succeed. The tradeoff, documented rather than hidden: repay needs the
 * debt asset already available to the coordinator's relay flow (see
 * lib/coordinator/execute.ts) — this loop's own borrowed-and-swapped asset
 * isn't sitting idle to fund it, the same real constraint every
 * non-flashloan deleverage flow has.
 *
 * Deliberately excludes the loop's final, debt-free redeposit — there is no
 * on-chain per-iteration partition of collateral (every deposit backs the
 * position's total debt together), so withdrawing unencumbered collateral
 * without a matching repay would only ever WORSEN health factor. Only
 * repay-backed tranches are ever safe to hand the guard.
 *
 * Ordered newest-iteration-first: unwinding the most recently added
 * exposure first is the standard deleverage order and lets the guard stop
 * as soon as enough tranches have cleared the breach.
 */
export function buildUnwindTranches(
  input: BuildOpenLoopStepsInput
): UnwindTranche[] {
  const { route, assetCode, borrowAssetCode } = input;
  const tranches: UnwindTranche[] = [];

  [...route.iterations].reverse().forEach((it, i) => {
    const protocol = it.poolType === "blend" ? "blend" : "neko";
    const repayId = `unwind-repay-${it.index}-${nanoid(6)}`;
    const withdrawId = `unwind-withdraw-${it.index}-${nanoid(6)}`;

    tranches.push({
      id: nanoid(),
      order: i,
      collateralAmount: it.depositAmount,
      debtAmount: it.borrowAmount,
      collateralPoolId: it.collateralPoolId,
      borrowPoolId: it.borrowPoolId,
      steps: [
        {
          id: repayId,
          type: "repay",
          protocol,
          label: `Repay ${borrowAssetCode} (iteration ${it.index})`,
          dependsOn: [],
          params: borrowParams(
            it.borrowPoolId,
            borrowAssetCode,
            it.borrowAmount
          ),
        },
        {
          id: withdrawId,
          type: "supply",
          protocol,
          label: `Withdraw ${assetCode} collateral (iteration ${it.index})`,
          dependsOn: [repayId],
          params: {
            mode: lit("collateral"),
            direction: lit("withdraw"),
            ...collateralParams(it.collateralPoolId, assetCode),
            amount: lit(it.depositAmount),
          },
        },
      ],
    });
  });

  return tranches;
}
