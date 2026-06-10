import { rpc } from "@stellar/stellar-sdk";

export interface WaitForTransactionOptions {
  maxAttempts?: number;
  intervalMs?: number;
}

export class TransactionFailedError extends Error {
  constructor(hash: string, status: string, message?: string) {
    super(
      message ?? `Transaction ${hash} failed on chain with status ${status}.`
    );
    this.name = "TransactionFailedError";
  }
}

export class TransactionTimeoutError extends Error {
  constructor(hash: string, maxAttempts: number, intervalMs: number) {
    super(
      `Timed out waiting for transaction ${hash} confirmation after ${maxAttempts} attempts at ${intervalMs}ms intervals. The transaction may still be pending.`
    );
    this.name = "TransactionTimeoutError";
  }
}

export async function waitForTransaction(
  txHash: string,
  server: rpc.Server,
  opts: WaitForTransactionOptions = {}
): Promise<unknown> {
  const { maxAttempts = 20, intervalMs = 2000 } = opts;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await server.getTransaction(txHash);

    if (result.status === "SUCCESS") {
      return result;
    }

    if (result.status === "FAILED") {
      const errorDetails =
        result.result && typeof result.result === "object"
          ? JSON.stringify(result.result)
          : String((result as any).error ?? result.status);

      throw new TransactionFailedError(
        txHash,
        result.status,
        `Transaction ${txHash} failed on chain. ${errorDetails}`
      );
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new TransactionTimeoutError(txHash, maxAttempts, intervalMs);
}
