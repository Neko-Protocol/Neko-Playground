import { TransactionBuilder } from "@stellar/stellar-sdk";
import { getSorobanServer } from "./sorobanServer";
import {
  isUserCancellationError,
  mapContractError,
  type MappedContractError,
} from "./contractErrors";
import {
  waitForTransaction,
  type WaitForTransactionOptions,
} from "./waitForTransaction";
import type { SignTransactionFn } from "./transaction";

export type ExecuteTransactionResult =
  | { status: "success"; hash: string; confirmation?: unknown }
  | { status: "contract_error"; error: MappedContractError }
  | { status: "network_error"; message: string; cause?: unknown }
  | { status: "user_rejected" };

export interface ExecuteTransactionOptions {
  xdr: string;
  signTransaction: SignTransactionFn;
  networkPassphrase: string;
  address?: string;
  contractName?: string;
  rpcUrl?: string;
  confirmation?: "wait" | "poll" | "none";
  waitOptions?: WaitForTransactionOptions;
  pollOptions?: { attempts?: number };
}

function isContractFailure(error: unknown): boolean {
  if (!error) return false;
  const str = String(error);
  return (
    str.includes("Error(Contract,") ||
    str.includes("HostError:") ||
    str.includes("simulation failed")
  );
}

/**
 * Signs, submits, and optionally confirms a Soroban transaction.
 * Returns a typed result instead of throwing for expected failure modes.
 */
export async function executeTransaction(
  options: ExecuteTransactionOptions
): Promise<ExecuteTransactionResult> {
  const {
    xdr,
    signTransaction,
    networkPassphrase,
    address,
    contractName,
    rpcUrl,
    confirmation = "wait",
    waitOptions,
    pollOptions,
  } = options;

  try {
    const signed = await signTransaction(xdr, {
      networkPassphrase,
      address,
    });

    const tx = TransactionBuilder.fromXDR(
      signed.signedTxXdr,
      networkPassphrase
    );
    const server = getSorobanServer(rpcUrl);
    const sendResult = await server.sendTransaction(tx);

    if (sendResult.status === "ERROR") {
      return {
        status: "network_error",
        message: `Transaction submission failed with status ${sendResult.status}`,
      };
    }

    const hash = sendResult.hash;

    if (confirmation === "none") {
      return { status: "success", hash };
    }

    if (confirmation === "poll") {
      const confirmed = await server.pollTransaction(hash, {
        attempts: pollOptions?.attempts ?? 30,
      });
      if (confirmed.status !== "SUCCESS") {
        const mapped = mapContractError(
          new Error(
            confirmed.status === "FAILED"
              ? "Transaction failed on-chain"
              : "Transaction confirmation timeout"
          ),
          contractName
        );
        if (mapped) {
          return { status: "contract_error", error: mapped };
        }
        return {
          status: "network_error",
          message:
            confirmed.status === "FAILED"
              ? "Transaction failed on-chain"
              : "Transaction confirmation timeout",
        };
      }
      return { status: "success", hash, confirmation: confirmed };
    }

    const confirmationResult = await waitForTransaction(
      hash,
      server,
      waitOptions
    );
    return { status: "success", hash, confirmation: confirmationResult };
  } catch (error) {
    if (isUserCancellationError(error)) {
      return { status: "user_rejected" };
    }

    const mapped = mapContractError(error, contractName);
    if (mapped && isContractFailure(error)) {
      return { status: "contract_error", error: mapped };
    }

    if (mapped && mapped.kind !== "other") {
      return { status: "contract_error", error: mapped };
    }

    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";

    if (
      message.toLowerCase().includes("network") ||
      message.toLowerCase().includes("timeout") ||
      error instanceof TypeError
    ) {
      return { status: "network_error", message, cause: error };
    }

    if (mapped) {
      return { status: "contract_error", error: mapped };
    }

    return { status: "network_error", message, cause: error };
  }
}

/** Submit a signed XDR without confirmation (for multi-phase transports). */
export async function submitSignedTransaction(
  signedXdr: string,
  networkPassphrase: string,
  rpcUrl?: string
): Promise<{ hash: string }> {
  const server = getSorobanServer(rpcUrl);
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const result = await server.sendTransaction(tx);
  return { hash: result.hash };
}

/** Confirm a previously submitted transaction hash. */
export async function confirmTransactionHash(
  hash: string,
  rpcUrl?: string,
  waitOptions?: WaitForTransactionOptions
): Promise<unknown> {
  const server = getSorobanServer(rpcUrl);
  return waitForTransaction(hash, server, waitOptions);
}
