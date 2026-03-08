import { extractContractError } from "@/lib/helpers/stellar/contractErrors";

export class OrchestratorError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OrchestratorError";
  }
}

export class PoolNotFoundError extends OrchestratorError {
  constructor(public readonly poolId: string) {
    super(`Pool not found: ${poolId}`);
    this.name = "PoolNotFoundError";
  }
}

export class AdapterError extends OrchestratorError {
  public readonly userMessage: string;

  constructor(adapterType: string, operation: string, cause: unknown) {
    const friendly = extractContractError(cause);
    super(`[${adapterType}] ${operation} failed: ${friendly}`, { cause });
    this.name = "AdapterError";
    this.userMessage = friendly;
  }
}

export class UnsupportedActionError extends OrchestratorError {
  constructor(
    public readonly adapterType: string,
    public readonly action: string
  ) {
    super(`[${adapterType}] does not support action: ${action}`);
    this.name = "UnsupportedActionError";
  }
}
