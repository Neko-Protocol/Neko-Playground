import { z } from "zod";
import {
  UnknownStepDefinitionError,
  type StepType,
  type StrategyStepDefinition,
  type ValidationIssue,
} from "./types";

function key(stepType: string, protocol: string): string {
  return `${stepType}:${protocol}`;
}

/**
 * Fallback definition for a (stepType, protocol) pair the registry doesn't
 * recognize — a future app version's step type opened in an older build, or
 * vice versa. Persistence keeps the step's raw data verbatim; this
 * definition lets the rest of the engine (validation/simulation/composer
 * UI) handle it gracefully instead of crashing or silently dropping user
 * data.
 */
function createUnknownStepDefinition(
  stepType: string,
  protocol: string
): StrategyStepDefinition {
  const message = `Unrecognized step type "${stepType}:${protocol}" — this step is preserved but cannot be validated, simulated, or executed in this version of the app.`;

  return {
    stepType: stepType as StepType,
    protocol,
    submissionMode: "rpc",
    paramsSchema: z.record(z.string(), z.unknown()),
    describeOutputs: () => [],
    validate: (): ValidationIssue[] => [
      { stepId: null, severity: "error", code: "UNKNOWN_STEP_TYPE", message },
    ],
    simulate: async () => {
      throw new Error(message);
    },
    prepare: async () => {
      throw new Error(message);
    },
  };
}

/**
 * Maps (stepType, protocol) -> StrategyStepDefinition. Mirrors
 * lib/orchestrator/core/PoolRegistry.ts's register/resolve shape so the
 * engine's validation/simulation/execution layers never import a concrete
 * protocol — only this registry.
 */
export class StrategyStepRegistry {
  private definitions = new Map<string, StrategyStepDefinition>();

  register(definition: StrategyStepDefinition): void {
    this.definitions.set(
      key(definition.stepType, definition.protocol),
      definition
    );
  }

  /** Throws UnknownStepDefinitionError unless a fallback has been registered for the given key. */
  resolve(
    stepType: StepType | string,
    protocol: string
  ): StrategyStepDefinition {
    const found = this.definitions.get(key(stepType, protocol));
    if (!found) throw new UnknownStepDefinitionError(stepType, protocol);
    return found;
  }

  tryResolve(
    stepType: StepType | string,
    protocol: string
  ): StrategyStepDefinition | null {
    return this.definitions.get(key(stepType, protocol)) ?? null;
  }

  /** Never throws — falls back to a graceful "unknown step" definition. */
  resolveOrUnknown(
    stepType: StepType | string,
    protocol: string
  ): StrategyStepDefinition {
    return (
      this.tryResolve(stepType, protocol) ??
      createUnknownStepDefinition(stepType, protocol)
    );
  }

  has(stepType: StepType | string, protocol: string): boolean {
    return this.definitions.has(key(stepType, protocol));
  }

  listRegistered(): StrategyStepDefinition[] {
    return [...this.definitions.values()];
  }
}

export const strategyStepRegistry = new StrategyStepRegistry();
export { createUnknownStepDefinition };
