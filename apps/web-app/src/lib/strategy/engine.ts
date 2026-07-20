import { toSmallestUnit, fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import {
  calculateProjectedHealthFactor,
  calculateLiquidationPrice,
  getRiskTier,
} from "@/features/borrowing/utils/liquidationPrice";
import { HF_WARNING } from "@/features/borrowing/const/riskThresholds";
import { strategyStepRegistry, type StrategyStepRegistry } from "./registry";
import type {
  ParamBinding,
  ResultingPosition,
  RiskAssessment,
  RiskThresholdConfig,
  SensitivityScenario,
  StepExecutionContext,
  StepPort,
  StepProjection,
  Strategy,
  StrategyStep,
  StrategyStepDefinition,
  StrategyProjection,
  ValidationIssue,
  ValidationResult,
} from "./types";

// ─── Cycle detection ─────────────────────────────────────────────────────────

export interface TopologicalSortResult {
  /** Execution order (topological). Null when the graph has a cycle. */
  order: string[] | null;
  issues: ValidationIssue[];
}

/**
 * Kahn's algorithm over steps[].dependsOn. Dangling references (a dependsOn
 * id that doesn't match any step) are silently skipped here — that's a
 * structural issue validateStrategy reports separately, not a cycle.
 */
export function topologicalSort(steps: StrategyStep[]): TopologicalSortResult {
  const ids = new Set(steps.map((s) => s.id));
  const stepIndex = new Map(steps.map((s, i) => [s.id, i]));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const step of steps) {
    inDegree.set(step.id, 0);
    adjacency.set(step.id, []);
  }
  for (const step of steps) {
    for (const depId of step.dependsOn) {
      if (!ids.has(depId)) continue;
      adjacency.get(depId)!.push(step.id);
      inDegree.set(step.id, (inDegree.get(step.id) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)
    .sort((a, b) => stepIndex.get(a)! - stepIndex.get(b)!);

  const remainingInDegree = new Map(inDegree);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const deg = (remainingInDegree.get(next) ?? 0) - 1;
      remainingInDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  if (order.length === steps.length) return { order, issues: [] };

  const cyclicIds = steps.map((s) => s.id).filter((id) => !order.includes(id));
  return {
    order: null,
    issues: [
      {
        stepId: cyclicIds[0] ?? null,
        severity: "error",
        code: "CIRCULAR_DEPENDENCY",
        message: `Circular dependency detected among steps: ${cyclicIds.join(", ")}`,
      },
    ],
  };
}

// ─── Validation ──────────────────────────────────────────────────────────────

export interface ValidateStrategyContext {
  userAddress?: string;
  networkPassphrase?: string;
  /** assetCode -> decimal string balance, from useWallet(). Omit to skip balance checks. */
  balances?: Record<string, string>;
  /** Defaults to the shared built-in registry singleton — injectable for tests. */
  registry?: StrategyStepRegistry;
}

function literalString(binding: ParamBinding | undefined): string | null {
  if (!binding || binding.source !== "literal") return null;
  return typeof binding.value === "string" ? binding.value : null;
}

/**
 * Cross-checks each root step's (no dependsOn — funded directly by the
 * wallet, not an upstream step's output) literal amount against the
 * connected wallet's balances. Common param names ("assetCode"/"tokenIn"
 * and "amount"/"amountIn") are checked heuristically since the step model
 * doesn't have one canonical "primary input" field name across all 8 step
 * types; steps with bound (non-literal) inputs are skipped — their funding
 * is validated at simulate-time as the upstream output resolves.
 */
export function validateBalances(
  strategy: Strategy,
  balances: Record<string, string>
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const step of strategy.steps) {
    if (step.dependsOn.length > 0) continue;
    const assetCode =
      literalString(step.params.assetCode) ??
      literalString(step.params.tokenIn);
    const amount =
      literalString(step.params.amount) ?? literalString(step.params.amountIn);
    if (!assetCode || !amount) continue;
    const available = balances[assetCode];
    if (available == null) continue;
    if (toSmallestUnit(amount, 7) > toSmallestUnit(available, 7)) {
      issues.push({
        stepId: step.id,
        severity: "error",
        code: "INSUFFICIENT_BALANCE",
        message: `Step "${step.label}" needs ${amount} ${assetCode} but the connected wallet only has ${available}.`,
      });
    }
  }
  return issues;
}

/**
 * For structural validation we don't run the full simulate() pipeline (that
 * requires live quotes/prices and is simulateStrategy's job), so
 * stepOutput-bound params resolve to a placeholder "1" here — enough for a
 * definition's own validate() to check literal fields (asset codes,
 * required ids) without flagging a normally-valid bound amount as missing.
 */
function resolveParamsForStructuralValidation(
  step: StrategyStep
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, binding] of Object.entries(step.params)) {
    resolved[key] = binding.source === "literal" ? binding.value : "1";
  }
  return resolved;
}

function safeValidate(
  definition: StrategyStepDefinition,
  ctx: StepExecutionContext
): ValidationIssue[] {
  try {
    return definition.validate(ctx);
  } catch (error) {
    return [
      {
        stepId: null,
        severity: "error",
        code: "VALIDATION_ERROR",
        message: error instanceof Error ? error.message : String(error),
      },
    ];
  }
}

function withStepId(issue: ValidationIssue, stepId: string): ValidationIssue {
  return issue.stepId ? issue : { ...issue, stepId };
}

export function validateStrategy(
  strategy: Strategy,
  ctx: ValidateStrategyContext = {}
): ValidationResult {
  const registry = ctx.registry ?? strategyStepRegistry;
  const issues: ValidationIssue[] = [];
  const stepIds = new Set(strategy.steps.map((s) => s.id));
  const indexById = new Map(strategy.steps.map((s, i) => [s.id, i]));

  for (const step of strategy.steps) {
    for (const depId of step.dependsOn) {
      if (!stepIds.has(depId)) {
        issues.push({
          stepId: step.id,
          severity: "error",
          code: "INVALID_DEPENDENCY",
          message: `Step "${step.label}" depends on unknown step id "${depId}".`,
        });
      } else if (indexById.get(depId)! >= indexById.get(step.id)!) {
        issues.push({
          stepId: step.id,
          severity: "error",
          code: "INVALID_DEPENDENCY",
          message: `Step "${step.label}" depends on "${depId}", which is not ordered before it.`,
        });
      }
    }
  }

  for (const step of strategy.steps) {
    for (const [paramKey, binding] of Object.entries(step.params)) {
      if (
        binding.source === "stepOutput" &&
        !step.dependsOn.includes(binding.stepId)
      ) {
        issues.push({
          stepId: step.id,
          severity: "error",
          code: "UNDECLARED_DEPENDENCY",
          message: `Step "${step.label}" param "${paramKey}" binds to step "${binding.stepId}"'s output but doesn't declare it in dependsOn.`,
        });
      }
    }
  }

  const { order, issues: cycleIssues } = topologicalSort(strategy.steps);
  issues.push(...cycleIssues);

  const traversalOrder = order ?? strategy.steps.map((s) => s.id);
  const stepsById = new Map(strategy.steps.map((s) => [s.id, s]));
  const outputPortsByStep: Record<string, StepPort[]> = {};

  for (const stepId of traversalOrder) {
    const step = stepsById.get(stepId);
    if (!step) continue;

    const definition = registry.tryResolve(step.type, step.protocol);
    if (!definition) {
      issues.push({
        stepId: step.id,
        severity: "error",
        code: "UNSUPPORTED_STEP",
        message: `No step definition registered for "${step.type}:${step.protocol}".`,
      });
      continue;
    }

    for (const [paramKey, binding] of Object.entries(step.params)) {
      if (binding.source !== "stepOutput") continue;
      const upstreamPorts = outputPortsByStep[binding.stepId];
      if (
        upstreamPorts &&
        !upstreamPorts.some((p) => p.id === binding.portId)
      ) {
        issues.push({
          stepId: step.id,
          severity: "error",
          code: "INCOMPATIBLE_ASSET",
          message: `Step "${step.label}" param "${paramKey}" binds to port "${binding.portId}" which step "${binding.stepId}" doesn't expose.`,
        });
      }
    }

    const resolvedParams = resolveParamsForStructuralValidation(step);
    const definitionIssues = safeValidate(definition, {
      userAddress: ctx.userAddress ?? "",
      networkPassphrase: ctx.networkPassphrase ?? "",
      resolvedParams,
      upstreamOutputs: {},
    });
    issues.push(...definitionIssues.map((issue) => withStepId(issue, step.id)));

    try {
      outputPortsByStep[step.id] = definition.describeOutputs(
        resolvedParams as never
      );
    } catch {
      outputPortsByStep[step.id] = [];
    }
  }

  if (ctx.balances) issues.push(...validateBalances(strategy, ctx.balances));

  return { valid: !issues.some((i) => i.severity === "error"), issues };
}

// ─── Risk ────────────────────────────────────────────────────────────────────

const DEFAULT_COLLATERAL_FACTOR_PCT = 75;

/** Notional exposure per protocol: sum of |collateralDelta| + |debtDelta|. */
export function computeProtocolExposure(
  positions: ResultingPosition[]
): Record<string, number> {
  const exposure: Record<string, number> = {};
  for (const position of positions) {
    const amount =
      Math.abs(position.collateralDelta ?? 0) +
      Math.abs(position.debtDelta ?? 0);
    if (amount <= 0) continue;
    exposure[position.protocol] = (exposure[position.protocol] ?? 0) + amount;
  }
  return exposure;
}

/**
 * Aggregates per-step resultingPosition deltas into one projected risk
 * assessment for the whole strategy.
 *
 * Collateral/debt deltas are summed directly in their own reported units,
 * not converted to a common USD basis — a documented simplification for
 * this version. Real cross-asset value conversion via the oracle price
 * feeds is tracked as follow-up work alongside the LP-remove gap.
 */
export function evaluateRisk(
  positions: ResultingPosition[],
  cumulativeSlippageBps: number
): RiskAssessment {
  let collateralValue = 0;
  let debtValue = 0;
  let collateralFactorPct = DEFAULT_COLLATERAL_FACTOR_PCT;
  let sawPosition = false;

  for (const position of positions) {
    if (position.collateralDelta) {
      collateralValue += position.collateralDelta;
      sawPosition = true;
    }
    if (position.debtDelta) {
      debtValue += position.debtDelta;
      sawPosition = true;
    }
    if (position.collateralFactorPct != null)
      collateralFactorPct = position.collateralFactorPct;
  }

  const projectedHealthFactor = sawPosition
    ? calculateProjectedHealthFactor(
        collateralValue,
        debtValue,
        collateralFactorPct
      )
    : null;
  const projectedLiquidationPrice = sawPosition
    ? calculateLiquidationPrice(collateralValue, debtValue, collateralFactorPct)
    : null;
  const effectiveLeverage =
    collateralValue > 0 && collateralValue - debtValue > 0
      ? collateralValue / (collateralValue - debtValue)
      : null;

  return {
    effectiveLeverage,
    projectedHealthFactor,
    projectedLiquidationPrice,
    cumulativeSlippageBps,
    riskTier: getRiskTier(projectedHealthFactor),
    protocolExposure: computeProtocolExposure(positions),
  };
}

export const DEFAULT_RISK_THRESHOLDS: RiskThresholdConfig = {
  // Reuses the app-wide submit-time warning threshold as the strategy-level minimum acknowledgeable health factor.
  minHealthFactor: HF_WARNING,
  maxLeverage: 3,
  maxCumulativeSlippageBps: 300,
  deviationThresholds: { swap: 0.05, lpAdd: 0.05, lpRemove: 0.05 },
  defaultDeviationThreshold: 0.03,
};

export function exceedsThresholds(
  assessment: RiskAssessment,
  config: RiskThresholdConfig = DEFAULT_RISK_THRESHOLDS
): boolean {
  if (
    assessment.projectedHealthFactor != null &&
    assessment.projectedHealthFactor < config.minHealthFactor
  )
    return true;
  if (
    assessment.effectiveLeverage != null &&
    assessment.effectiveLeverage > config.maxLeverage
  )
    return true;
  if (assessment.cumulativeSlippageBps > config.maxCumulativeSlippageBps)
    return true;
  return false;
}

export function deviationThresholdFor(
  stepType: string,
  config: RiskThresholdConfig = DEFAULT_RISK_THRESHOLDS
): number {
  return (
    config.deviationThresholds[stepType] ?? config.defaultDeviationThreshold
  );
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export interface AggregatedProjection {
  cumulativeFee: string;
  cumulativeSlippageBps: number;
  projectedApy: number | null;
}

export function aggregateProjection(
  steps: Record<string, StepProjection>
): AggregatedProjection {
  const values = Object.values(steps);
  let feeAcc = 0n;
  let slippageAcc = 0;
  let apySum = 0;
  let apyCount = 0;

  for (const step of values) {
    feeAcc += toSmallestUnit(step.estimatedFee, 7);
    slippageAcc += step.slippageBps ?? 0;
    if (step.projectedApyDelta != null) {
      apySum += step.projectedApyDelta;
      apyCount += 1;
    }
  }

  return {
    cumulativeFee: fromSmallestUnit(feeAcc.toString(), 7),
    cumulativeSlippageBps: slippageAcc,
    projectedApy: apyCount > 0 ? apySum : null,
  };
}

export interface SimulateStrategyContext {
  userAddress: string;
  networkPassphrase: string;
  registry?: StrategyStepRegistry;
}

function resolveBinding(
  binding: ParamBinding,
  upstreamOutputs: Record<string, Record<string, unknown>>
): unknown {
  if (binding.source === "literal") return binding.value;
  return upstreamOutputs[binding.stepId]?.[binding.portId];
}

function resolveParams(
  step: StrategyStep,
  upstreamOutputs: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, binding] of Object.entries(step.params))
    resolved[key] = resolveBinding(binding, upstreamOutputs);
  return resolved;
}

function simulationFailure(
  failedStepId: string | undefined,
  failureReason: string,
  steps: Record<string, StepProjection>
): StrategyProjection {
  return {
    success: false,
    failedStepId,
    failureReason,
    steps,
    cumulativeFee: "0",
    cumulativeSlippageBps: 0,
    projectedApy: null,
    effectiveLeverage: null,
    projectedHealthFactor: null,
    projectedLiquidationPrice: null,
  };
}

/**
 * Walks the strategy's steps in dependency order, calling each step
 * definition's simulate() and feeding its outputs forward as the next
 * step's upstreamOutputs — the automatic output-propagation the spec
 * requires. Stops and reports the exact blocking step on any failure, never
 * returns a silently-partial success.
 */
export async function simulateStrategy(
  strategy: Strategy,
  execCtx: SimulateStrategyContext
): Promise<StrategyProjection> {
  const registry = execCtx.registry ?? strategyStepRegistry;
  const { order, issues: cycleIssues } = topologicalSort(strategy.steps);
  if (!order)
    return simulationFailure(
      cycleIssues[0]?.stepId ?? undefined,
      cycleIssues[0]?.message ?? "Circular dependency detected",
      {}
    );

  const stepsById = new Map(strategy.steps.map((s) => [s.id, s]));
  const outputsByStep: Record<string, Record<string, unknown>> = {};
  const projections: Record<string, StepProjection> = {};

  for (const stepId of order) {
    const step = stepsById.get(stepId);
    if (!step) continue;

    const definition = registry.tryResolve(step.type, step.protocol);
    if (!definition)
      return simulationFailure(
        step.id,
        `No step definition registered for ${step.type}:${step.protocol}`,
        projections
      );

    const ctx: StepExecutionContext = {
      userAddress: execCtx.userAddress,
      networkPassphrase: execCtx.networkPassphrase,
      resolvedParams: resolveParams(step, outputsByStep),
      upstreamOutputs: outputsByStep,
    };

    try {
      const projection = await definition.simulate(ctx);
      projections[step.id] = projection;
      outputsByStep[step.id] = projection.outputs;
    } catch (error) {
      return simulationFailure(
        step.id,
        error instanceof Error ? error.message : String(error),
        projections
      );
    }
  }

  const aggregate = aggregateProjection(projections);
  const positions: ResultingPosition[] = Object.values(projections)
    .map((p) => p.resultingPosition)
    .filter((p): p is ResultingPosition => Boolean(p));
  const risk = evaluateRisk(positions, aggregate.cumulativeSlippageBps);

  return {
    success: true,
    steps: projections,
    cumulativeFee: aggregate.cumulativeFee,
    cumulativeSlippageBps: aggregate.cumulativeSlippageBps,
    projectedApy: aggregate.projectedApy,
    effectiveLeverage: risk.effectiveLeverage,
    projectedHealthFactor: risk.projectedHealthFactor,
    projectedLiquidationPrice: risk.projectedLiquidationPrice,
  };
}

// ─── Sensitivity analysis ────────────────────────────────────────────────────

type ScenarioConfig = Omit<SensitivityScenario, "projection">;

export const DEFAULT_SENSITIVITY_SCENARIOS: ScenarioConfig[] = [
  { label: "Base case", slippageMultiplier: 1, priceShockPct: 0 },
  { label: "High slippage", slippageMultiplier: 2, priceShockPct: 0 },
  {
    label: "Adverse price move (-10%)",
    slippageMultiplier: 1,
    priceShockPct: -0.1,
  },
  {
    label: "Stress (2x slippage, -10% price)",
    slippageMultiplier: 2,
    priceShockPct: -0.1,
  },
];

/**
 * Produces sensitivity scenarios by analytically scaling a single baseline
 * StrategyProjection's slippage and price-dependent figures, rather than
 * re-running every step definition's simulate() with perturbed live inputs
 * (quotes, oracle prices) — that would require plumbing shock parameters
 * through all step definitions, tracked as follow-up scope. Health factor
 * and liquidation price are assumed to scale roughly linearly with a
 * collateral-value price shock, accurate for small shocks and clearly a
 * projection, not a guarantee.
 */
export function computeSensitivity(
  baseline: StrategyProjection,
  scenarios: ScenarioConfig[] = DEFAULT_SENSITIVITY_SCENARIOS
): SensitivityScenario[] {
  if (!baseline.success)
    return scenarios.map((scenario) => ({ ...scenario, projection: baseline }));

  return scenarios.map((scenario) => {
    const cumulativeSlippageBps = Math.round(
      baseline.cumulativeSlippageBps * scenario.slippageMultiplier
    );
    let projectedHealthFactor = baseline.projectedHealthFactor;
    let projectedLiquidationPrice = baseline.projectedLiquidationPrice;

    if (
      scenario.priceShockPct !== 0 &&
      baseline.projectedHealthFactor != null
    ) {
      projectedHealthFactor =
        baseline.projectedHealthFactor * (1 + scenario.priceShockPct);
      projectedLiquidationPrice =
        baseline.projectedLiquidationPrice != null
          ? baseline.projectedLiquidationPrice * (1 - scenario.priceShockPct)
          : null;
    }

    return {
      ...scenario,
      projection: {
        ...baseline,
        cumulativeSlippageBps,
        projectedHealthFactor,
        projectedLiquidationPrice,
      },
    };
  });
}
