/**
 * Typed error hierarchy for the Pool Orchestrator.
 *
 * Every error extends `OrchestratorError` so callers can catch
 * the entire family with a single `instanceof` check while still
 * being able to narrow to specific sub-types.
 */

import { extractContractError } from "@/lib/helpers/contractErrors";

/** Base class for all orchestrator errors. */
export class OrchestratorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OrchestratorError";
  }
}

/** Thrown when a pool id cannot be resolved to any registered adapter. */
export class PoolNotFoundError extends OrchestratorError {
  constructor(public readonly poolId: string) {
    super(`Pool not found: ${poolId}`);
    this.name = "PoolNotFoundError";
  }
}

/**
 * Thrown when an adapter encounters an error during a contract call.
 * Wraps the original error and provides a user-friendly message
 * extracted via the existing `extractContractError` utility.
 */
export class AdapterError extends OrchestratorError {
  public readonly userMessage: string;

  constructor(adapterType: string, operation: string, cause: unknown) {
    const friendly = extractContractError(cause);
    super(`[${adapterType}] ${operation} failed: ${friendly}`, { cause });
    this.name = "AdapterError";
    this.userMessage = friendly;
  }
}

/** Thrown when a caller requests an action the adapter does not support. */
export class UnsupportedActionError extends OrchestratorError {
  constructor(
    public readonly adapterType: string,
    public readonly action: string
  ) {
    super(`[${adapterType}] does not support action: ${action}`);
    this.name = "UnsupportedActionError";
  }
}
