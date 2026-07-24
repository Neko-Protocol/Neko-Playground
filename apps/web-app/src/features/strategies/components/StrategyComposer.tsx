"use client";

import { useMemo, useState } from "react";
import { nanoid } from "nanoid";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Trash2,
} from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import {
  useStrategyPersistence,
  useStrategyValidation,
  useStrategySimulation,
  useStrategyExecution,
} from "@/lib/strategy/hooks";
import { exceedsThresholds } from "@/lib/strategy/engine";
import { strategyStepRegistry } from "@/lib/strategy/registry";
import { getRiskTier } from "@/features/borrowing/utils/liquidationPrice";
import type {
  ExecutionRecord,
  ParamBinding,
  RiskAssessment,
  StepPort,
  Strategy,
  StrategyStep,
  StrategyStepDefinition,
  ValidationResult,
} from "@/lib/strategy/types";
import { useStrategyComposerState } from "../hooks";
import {
  SimulationSummary,
  SensitivityPanel,
  RiskAcknowledgementModal,
  ExecutionProgress,
  DeviationPauseModal,
} from "./ExecutionUI";

// ─── Step palette ────────────────────────────────────────────────────────────

export interface StepPaletteProps {
  onAdd: (definition: StrategyStepDefinition) => void;
}

/** "Add step" picker, grouped by step type, backed by the registered step definitions. */
export function StepPalette({ onAdd }: StepPaletteProps) {
  const definitions = useMemo(() => strategyStepRegistry.listRegistered(), []);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
        Add a step
      </h4>
      <div
        className="flex flex-wrap gap-2"
        role="list"
        aria-label="Available step types"
      >
        {definitions.map((definition) => (
          <button
            key={`${definition.stepType}:${definition.protocol}`}
            type="button"
            role="listitem"
            onClick={() => onAdd(definition)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/80 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#229EDF]"
          >
            {definition.stepType}
            <span className="ml-1.5 text-white/40">
              ({definition.protocol})
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Port binding editor ─────────────────────────────────────────────────────

export interface UpstreamPortOption {
  stepId: string;
  stepLabel: string;
  port: StepPort;
}

interface PortBindingEditorProps {
  paramKey: string;
  binding: ParamBinding;
  upstreamOptions: UpstreamPortOption[];
  onChange: (binding: ParamBinding) => void;
}

/**
 * Lets a step's param be bound either to a literal value or to an upstream
 * step's output port. Uses native <select>/<input> — screen-reader
 * friendly and keyboard operable by default, no custom widget needed.
 */
function PortBindingEditor({
  paramKey,
  binding,
  upstreamOptions,
  onChange,
}: PortBindingEditorProps) {
  const inputId = `param-${paramKey}`;
  const sourceId = `param-source-${paramKey}`;

  return (
    <div className="flex flex-1 items-center gap-2">
      <label htmlFor={sourceId} className="sr-only">
        {paramKey} source
      </label>
      <select
        id={sourceId}
        value={binding.source}
        onChange={(e) => {
          if (e.target.value === "literal")
            onChange({ source: "literal", value: "" });
          else if (upstreamOptions[0])
            onChange({
              source: "stepOutput",
              stepId: upstreamOptions[0].stepId,
              portId: upstreamOptions[0].port.id,
            });
        }}
        className="rounded-lg border border-white/10 bg-[#121212] px-2 py-1.5 text-xs text-white/70"
      >
        <option value="literal">Fixed value</option>
        <option value="stepOutput" disabled={upstreamOptions.length === 0}>
          From previous step
        </option>
      </select>

      {binding.source === "literal" ? (
        <>
          <label htmlFor={inputId} className="sr-only">
            {paramKey} value
          </label>
          <input
            id={inputId}
            type="text"
            value={
              typeof binding.value === "string"
                ? binding.value
                : String(binding.value ?? "")
            }
            onChange={(e) =>
              onChange({ source: "literal", value: e.target.value })
            }
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#121212] px-2 py-1.5 text-sm text-white"
          />
        </>
      ) : (
        <>
          <label htmlFor={inputId} className="sr-only">
            {paramKey} source port
          </label>
          <select
            id={inputId}
            value={`${binding.stepId}::${binding.portId}`}
            onChange={(e) => {
              const [stepId, portId] = e.target.value.split("::");
              onChange({ source: "stepOutput", stepId, portId });
            }}
            className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#121212] px-2 py-1.5 text-sm text-white"
          >
            {upstreamOptions.map(({ stepId, stepLabel, port }) => (
              <option
                key={`${stepId}::${port.id}`}
                value={`${stepId}::${port.id}`}
              >
                {stepLabel} → {port.id}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

// ─── Step params form ────────────────────────────────────────────────────────

interface StepParamsFormProps {
  params: Record<string, ParamBinding>;
  upstreamOptions: UpstreamPortOption[];
  onChange: (params: Record<string, ParamBinding>) => void;
}

/**
 * A generic key/value parameter editor — each step definition declares its
 * own paramsSchema, so rather than hand-building a bespoke form per step
 * type, this lets the user add/edit/remove named params directly, with a
 * literal-vs-bound-to-upstream-output toggle per param (PortBindingEditor).
 */
function StepParamsForm({
  params,
  upstreamOptions,
  onChange,
}: StepParamsFormProps) {
  const [newKey, setNewKey] = useState("");

  const setParam = (key: string, binding: ParamBinding) =>
    onChange({ ...params, [key]: binding });
  const removeParam = (key: string) => {
    const next = { ...params };
    delete next[key];
    onChange(next);
  };
  const addParam = () => {
    const key = newKey.trim();
    if (!key || params[key]) return;
    onChange({ ...params, [key]: { source: "literal", value: "" } });
    setNewKey("");
  };

  return (
    <div className="flex flex-col gap-2">
      {Object.entries(params).map(([key, binding]) => (
        <div key={key} className="flex items-center gap-2">
          <span
            className="w-28 shrink-0 truncate text-xs text-white/50"
            title={key}
          >
            {key}
          </span>
          <PortBindingEditor
            paramKey={key}
            binding={binding}
            upstreamOptions={upstreamOptions}
            onChange={(next) => setParam(key, next)}
          />
          <button
            type="button"
            onClick={() => removeParam(key)}
            aria-label={`Remove parameter ${key}`}
            className="shrink-0 rounded-md p-1.5 text-white/30 hover:bg-white/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#229EDF]"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <form
        className="flex items-center gap-2 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          addParam();
        }}
      >
        <label htmlFor="new-param-key" className="sr-only">
          New parameter name
        </label>
        <input
          id="new-param-key"
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="parameter name"
          className="w-28 shrink-0 rounded-lg border border-dashed border-white/15 bg-transparent px-2 py-1.5 text-xs text-white placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={!newKey.trim()}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-white/60 hover:bg-white/5 disabled:opacity-40"
        >
          + Add parameter
        </button>
      </form>
    </div>
  );
}

// ─── Step card ───────────────────────────────────────────────────────────────

export interface StepCardProps {
  strategy: Strategy;
  step: StrategyStep;
  index: number;
  total: number;
  onMove: (direction: "up" | "down") => void;
  onRemove: () => void;
  onParamsChange: (params: Record<string, ParamBinding>) => void;
}

/** One step in the composer: keyboard-operable Move Up/Down + Remove, and an expandable param editor. */
export function StepCard({
  strategy,
  step,
  index,
  total,
  onMove,
  onRemove,
  onParamsChange,
}: StepCardProps) {
  const [expanded, setExpanded] = useState(false);

  const upstreamOptions = useMemo<UpstreamPortOption[]>(() => {
    const options: UpstreamPortOption[] = [];
    for (const upstream of strategy.steps.slice(0, index)) {
      const definition = strategyStepRegistry.tryResolve(
        upstream.type,
        upstream.protocol
      );
      if (!definition) continue;
      try {
        const literalParams: Record<string, unknown> = {};
        for (const [key, binding] of Object.entries(upstream.params))
          literalParams[key] =
            binding.source === "literal" ? binding.value : "1";
        for (const port of definition.describeOutputs(literalParams as never))
          options.push({
            stepId: upstream.id,
            stepLabel: upstream.label,
            port,
          });
      } catch {
        // definition couldn't describe outputs from partial params yet — skip
      }
    }
    return options;
  }, [strategy.steps, index]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#1C1C1C]">
      <div className="flex items-center gap-2 p-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs text-white/50">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">
            {step.label}
          </p>
          <p className="truncate text-xs text-white/40">
            {step.type} · {step.protocol}
          </p>
        </div>

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={`Reorder ${step.label}`}
        >
          <button
            type="button"
            onClick={() => onMove("up")}
            disabled={index === 0}
            aria-label={`Move ${step.label} up`}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#229EDF]"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => onMove("down")}
            disabled={index === total - 1}
            aria-label={`Move ${step.label} down`}
            className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#229EDF]"
          >
            <ArrowDown size={14} />
          </button>
        </div>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${step.label}`}
          className="rounded-md p-1.5 text-white/40 hover:bg-white/5 hover:text-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#229EDF]"
        >
          <Trash2 size={14} />
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Collapse ${step.label} parameters`
              : `Edit ${step.label} parameters`
          }
          className="rounded-md p-1.5 text-white/50 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#229EDF]"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/5 p-3">
          <StepParamsForm
            params={step.params}
            upstreamOptions={upstreamOptions}
            onChange={onParamsChange}
          />
        </div>
      )}
    </div>
  );
}

// ─── Validation panel ────────────────────────────────────────────────────────

export interface ValidationPanelProps {
  strategy: Strategy;
  result: ValidationResult;
}

/** Renders validation issues, each pointing at the exact failing step. */
export function ValidationPanel({ strategy, result }: ValidationPanelProps) {
  if (result.issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300">
        <CheckCircle2 size={16} />
        Strategy is valid.
      </div>
    );
  }

  const labelFor = (stepId: string | null) =>
    stepId
      ? (strategy.steps.find((s) => s.id === stepId)?.label ?? stepId)
      : null;

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
      role="alert"
    >
      {result.issues.map((issue, i) => {
        const stepLabel = labelFor(issue.stepId);
        const isWarning = issue.severity === "warning";
        return (
          <div
            key={`${issue.code}-${i}`}
            className={`flex items-start gap-2 text-sm ${isWarning ? "text-yellow-300" : "text-red-300"}`}
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {stepLabel && (
                <strong className="font-medium">{stepLabel}: </strong>
              )}
              {issue.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Strategy composer ───────────────────────────────────────────────────────

export interface StrategyComposerProps {
  initial: Strategy;
  onClose: () => void;
}

export function StrategyComposer({ initial, onClose }: StrategyComposerProps) {
  const { address } = useWallet();
  const { addNotification } = useToast();
  const { saveStrategy } = useStrategyPersistence();
  const { execute, isExecuting } = useStrategyExecution();

  const { strategy, addStep, removeStep, moveStep, updateStepParams, rename } =
    useStrategyComposerState(initial);

  const validation = useStrategyValidation(strategy);
  const simulationQuery = useStrategySimulation(strategy, validation.valid);

  const [showRiskAck, setShowRiskAck] = useState(false);
  const [execution, setExecution] = useState<ExecutionRecord | null>(null);

  const riskAssessment = useMemo<RiskAssessment | null>(() => {
    const projection = simulationQuery.data;
    if (!projection?.success) return null;
    return {
      effectiveLeverage: projection.effectiveLeverage,
      projectedHealthFactor: projection.projectedHealthFactor,
      projectedLiquidationPrice: projection.projectedLiquidationPrice,
      cumulativeSlippageBps: projection.cumulativeSlippageBps,
      riskTier: getRiskTier(projection.projectedHealthFactor),
      protocolExposure: {},
    };
  }, [simulationQuery.data]);

  const pausedStep = execution?.steps.find(
    (s) => s.status === "paused_deviation"
  );

  const runExecution = async (acknowledgedDeviationStepIds?: string[]) => {
    if (!address) return;
    const record: ExecutionRecord = execution ?? {
      id: nanoid(),
      strategyId: strategy.id,
      strategySnapshot: strategy,
      status: "in_progress",
      startedAt: Date.now(),
      updatedAt: Date.now(),
      projectedOutcome: simulationQuery.data ?? {},
      steps: [],
    };

    const result = await execute(strategy, record, {
      acknowledgedDeviationStepIds,
    });
    if (!result) return;
    setExecution(result.record);

    if (result.status === "completed") {
      addNotification("Strategy executed", "success", {
        description: `${strategy.name} completed successfully.`,
      });
    } else if (result.status === "failed") {
      addNotification("Strategy execution failed", "error", {
        description:
          result.record.steps.find((s) => s.status === "failed")
            ?.errorMessage ?? "An unexpected error occurred.",
      });
    }
  };

  const handleExecuteClick = () => {
    if (riskAssessment && exceedsThresholds(riskAssessment)) {
      setShowRiskAck(true);
      return;
    }
    void runExecution();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to strategies"
          className="rounded-full p-2 text-white/50 hover:bg-white/5 hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
        <label htmlFor="strategy-name" className="sr-only">
          Strategy name
        </label>
        <input
          id="strategy-name"
          value={strategy.name}
          onChange={(e) => rename(e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-white outline-none"
        />
        <button
          type="button"
          onClick={() => {
            saveStrategy(strategy);
            addNotification("Strategy saved", "success", {});
          }}
          className="rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          Save
        </button>
      </div>

      <StepPalette
        onAdd={(definition) =>
          addStep({
            type: definition.stepType,
            protocol: definition.protocol,
            label: `${definition.stepType} (${definition.protocol})`,
            params: {},
            dependsOn: [],
          })
        }
      />

      {strategy.steps.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40">
          Add a step above to start composing this strategy.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {strategy.steps.map((step, index) => (
            <StepCard
              key={step.id}
              strategy={strategy}
              step={step}
              index={index}
              total={strategy.steps.length}
              onMove={(direction) => moveStep(step.id, direction)}
              onRemove={() => removeStep(step.id)}
              onParamsChange={(params) => updateStepParams(step.id, params)}
            />
          ))}
        </div>
      )}

      <ValidationPanel strategy={strategy} result={validation} />

      {simulationQuery.data && (
        <div className="flex flex-col gap-4">
          <SimulationSummary projection={simulationQuery.data} />
          {simulationQuery.data.success && (
            <SensitivityPanel baseline={simulationQuery.data} />
          )}
        </div>
      )}

      {execution && (
        <ExecutionProgress strategy={strategy} execution={execution} />
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleExecuteClick}
          disabled={
            !validation.valid ||
            !simulationQuery.data?.success ||
            isExecuting ||
            !address
          }
          className="rounded-full bg-[#229EDF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1c8bc4] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isExecuting ? "Executing…" : "Execute strategy"}
        </button>
      </div>

      {showRiskAck && riskAssessment && (
        <RiskAcknowledgementModal
          assessment={riskAssessment}
          onCancel={() => setShowRiskAck(false)}
          onAcknowledge={() => {
            setShowRiskAck(false);
            void runExecution();
          }}
        />
      )}

      {pausedStep && (
        <DeviationPauseModal
          step={pausedStep}
          stepLabel={
            strategy.steps.find((s) => s.id === pausedStep.stepId)?.label ??
            pausedStep.stepId
          }
          onResume={() => void runExecution([pausedStep.stepId])}
          onAbandon={() =>
            setExecution((prev) =>
              prev ? { ...prev, status: "abandoned" } : prev
            )
          }
        />
      )}
    </div>
  );
}
