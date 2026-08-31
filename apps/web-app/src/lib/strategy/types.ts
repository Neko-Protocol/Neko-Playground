import type { z } from "zod";
import type { RiskTier } from "@/features/borrowing/const/riskThresholds";
import type { LeverageLoopStrategyMeta } from "./leverage/types";

// ─── Strategy model ──────────────────────────────────────────────────────────

export type StepType =
  | "swap"
  | "supply"
  | "borrow"
  | "repay"
  | "vaultDeposit"
  | "vaultWithdraw"
  | "lpAdd"
  | "lpRemove";

export type StepDirection = "deposit" | "withdraw";

export type PortKind =
  | "asset"
  | "shares"
  | "debtPosition"
  | "collateralPosition"
  | "lpPosition";

/** A typed output port produced by a step, consumable by a later step's input binding. */
export interface StepPort {
  id: string;
  assetCode: string | null;
  kind: PortKind;
}

/**
 * Binds a step's parameter to either a literal value the user typed, or an
 * upstream step's output port. Resolved at simulate-time/prepare-time, never
 * at edit-time — the composer only needs port compatibility, not protocol
 * knowledge, to offer valid bindings.
 */
export type ParamBinding<T = unknown> =
  | { source: "literal"; value: T }
  | { source: "stepOutput"; stepId: string; portId: string };

export interface StrategyStep {
  id: string;
  type: StepType;
  protocol: string;
  label: string;
  params: Record<string, ParamBinding>;
  /**
   * Explicit upstream step ids. Kept separate from stepOutput bindings so
   * validation can catch a *declared* dependency with no matching binding,
   * and a binding that references an *undeclared* dependency.
   */
  dependsOn: string[];
}

export interface Strategy {
  id: string;
  /** Document schema version — see the persistence types below. Not the app version. */
  version: number;
  name: string;
  description?: string;
  isTemplate: boolean;
  steps: StrategyStep[];
  createdAt: number;
  updatedAt: number;
  /**
   * Present only for a strategy built by the leverage-loop builder (Scope
   * §3) — an additive discriminated field, not a replacement of the generic
   * Strategy shape every other template also uses.
   */
  leverageMeta?: LeverageLoopStrategyMeta;
}

// ─── Step definition plugin interface ───────────────────────────────────────

export interface TxResult {
  xdr: string;
  networkPassphrase: string;
}

export interface StepExecutionContext {
  userAddress: string;
  networkPassphrase: string;
  /** ParamBindings already resolved to concrete values (literals or upstream outputs). */
  resolvedParams: Record<string, unknown>;
  /** stepId -> that step's StepProjection.outputs, for steps this one depends on. */
  upstreamOutputs: Record<string, Record<string, unknown>>;
}

/**
 * The plugin interface every protocol integration implements once per
 * (stepType, protocol) pair. The engine (validation/simulation/execution)
 * only ever talks to this interface via the registry — adding a protocol
 * means adding a definition and registering it, never touching the engine.
 */
export interface StrategyStepDefinition<TParams = Record<string, unknown>> {
  readonly stepType: StepType;
  readonly protocol: string;
  /** How prepare()'s xdr gets submitted — the engine branches on this once, centrally. */
  readonly submissionMode: "rpc" | "soroswapApi";
  /**
   * Parses untrusted `unknown` input into TParams. The input type is left open
   * rather than pinned to TParams so schemas that use `.default()` — whose
   * input type has those keys optional — still satisfy this.
   */
  readonly paramsSchema: z.ZodType<TParams, z.ZodTypeDef, unknown>;

  /** Declares this step's output ports so downstream steps can bind to them. */
  describeOutputs(params: TParams): StepPort[];

  /** Structural + protocol-specific validation for this step only. Empty array when valid. */
  validate(ctx: StepExecutionContext): ValidationIssue[];

  /** Off-chain financial projection. No signing, no submission. */
  simulate(ctx: StepExecutionContext): Promise<StepProjection>;

  /** Builds the unsigned tx for this step. */
  prepare(ctx: StepExecutionContext): Promise<TxResult>;

  /** Parses the actual on-chain result (post-confirm) for deviation checks. */
  interpretResult?(
    ctx: StepExecutionContext,
    confirmedResult: unknown
  ): Promise<Partial<StepProjection>>;
}

// ─── Validation ──────────────────────────────────────────────────────────────

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  /** The step this issue is about. Null for strategy-wide issues (e.g. a cycle spanning steps). */
  stepId: string | null;
  severity: ValidationSeverity;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export interface ResultingPosition {
  protocol: string;
  /**
   * Collateral/debt deltas in the asset's OWN decimal units (not USD) —
   * conversion to a common value basis happens centrally in the risk
   * evaluator using live oracle prices, not per step definition.
   */
  collateralAssetCode?: string;
  collateralDelta?: number;
  debtAssetCode?: string;
  debtDelta?: number;
  collateralFactorPct?: number;
  healthFactor?: number | null;
  liquidationPrice?: number | null;
}

export interface StepProjection {
  /** portId -> projected value, consumed by downstream steps as upstreamOutputs. */
  outputs: Record<string, unknown>;
  /** assetCode -> projected balance (decimal string), for steps that move wallet-held assets. */
  resultingBalances?: Record<string, string>;
  resultingPosition?: ResultingPosition;
  /** Decimal string, native asset units. */
  estimatedFee: string;
  slippageBps?: number;
  projectedApyDelta?: number;
  warnings: string[];
}

export interface StrategyProjection {
  success: boolean;
  /** Set when success is false — the step whose simulate() failed or couldn't resolve inputs. */
  failedStepId?: string;
  failureReason?: string;
  steps: Record<string, StepProjection>;
  cumulativeFee: string;
  cumulativeSlippageBps: number;
  projectedApy: number | null;
  effectiveLeverage: number | null;
  projectedHealthFactor: number | null;
  projectedLiquidationPrice: number | null;
}

export interface SensitivityScenario {
  label: string;
  slippageMultiplier: number;
  priceShockPct: number;
  projection: StrategyProjection;
}

// ─── Execution ───────────────────────────────────────────────────────────────

export type StepExecutionStatus =
  | "pending"
  | "preparing"
  | "awaiting_signature"
  | "submitting"
  | "confirming"
  | "completed"
  | "failed"
  | "paused_deviation"
  | "cancelled";

export interface DeviationReport {
  deviated: boolean;
  /** Relative deviation, e.g. 0.05 = 5% off projection. */
  relativeDeviation: number | null;
  threshold: number;
  message?: string;
}

export interface ExecutionStepRecord {
  stepId: string;
  status: StepExecutionStatus;
  txHash?: string;
  submittedAt?: number;
  confirmedAt?: number;
  actualOutputs?: Record<string, unknown>;
  deviation?: DeviationReport;
  errorMessage?: string;
}

export type ExecutionStatus =
  | "in_progress"
  | "completed"
  | "failed"
  | "paused-deviation"
  | "abandoned";

export interface ExecutionRecord {
  id: string;
  strategyId: string;
  strategySnapshot: unknown; // Strategy at the time execution started
  status: ExecutionStatus;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
  projectedOutcome: unknown; // StrategyProjection snapshot
  actualOutcome?: unknown;
  steps: ExecutionStepRecord[];
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export interface StrategyStorageSchema {
  version: number;
  strategies: Strategy[];
}

export interface ExecutionHistoryStorageSchema {
  version: number;
  executions: ExecutionRecord[];
}

// ─── Risk ────────────────────────────────────────────────────────────────────

export interface RiskAssessment {
  effectiveLeverage: number | null;
  projectedHealthFactor: number | null;
  projectedLiquidationPrice: number | null;
  cumulativeSlippageBps: number;
  riskTier: RiskTier;
  /** protocol -> notional exposure. */
  protocolExposure: Record<string, number>;
}

export interface RiskThresholdConfig {
  minHealthFactor: number;
  maxLeverage: number;
  maxCumulativeSlippageBps: number;
  /** Per step-type override of the guided-execution deviation-pause threshold (relative, e.g. 0.03). */
  deviationThresholds: Partial<Record<string, number>>;
  defaultDeviationThreshold: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class StrategyEngineError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StrategyEngineError";
  }
}

export class UnknownStepDefinitionError extends StrategyEngineError {
  constructor(
    public readonly stepType: string,
    public readonly protocol: string
  ) {
    super(`No step definition registered for ${stepType}:${protocol}`);
    this.name = "UnknownStepDefinitionError";
  }
}

export class CircularDependencyError extends StrategyEngineError {
  constructor(public readonly stepIds: string[]) {
    super(`Circular dependency detected among steps: ${stepIds.join(", ")}`);
    this.name = "CircularDependencyError";
  }
}
