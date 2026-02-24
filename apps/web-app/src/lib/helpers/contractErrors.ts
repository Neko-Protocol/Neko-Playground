/**
 * Contract Error Utilities
 * Extracts and formats error messages from Soroban contract errors
 */

import {
  CONTRACT_ERRORS,
  CONTRACT_ERRORS_BY_CONTRACT,
  ContractErrorCode,
  isValidErrorCode,
  getContractError,
} from "@/lib/constants/contracts";

/**
 * Try to extract contract name from error string
 * Looks for contract identifiers in the error message
 */
function extractContractNameFromError(errorString: string): string | null {
  const contractPatterns = [
    { pattern: /rwa-lending/i, name: "rwa-lending" },
    { pattern: /rwa-token/i, name: "rwa-token" },
    { pattern: /rwa-oracle/i, name: "rwa-oracle" },
    { pattern: /rwa-perps/i, name: "rwa-perps" },
    { pattern: /lending/i, name: "rwa-lending" },
    { pattern: /token/i, name: "rwa-token" },
    { pattern: /oracle/i, name: "rwa-oracle" },
    { pattern: /perps|perpetual/i, name: "rwa-perps" },
  ];

  for (const { pattern, name } of contractPatterns) {
    if (pattern.test(errorString)) {
      return name;
    }
  }

  return null;
}

/**
 * Extract a user-friendly error message from a contract error
 * @param error - The error object from a failed contract call
 * @param contractName - Optional contract name to narrow down error lookup
 * @returns A user-friendly error message
 */
export function extractContractError(
  error: unknown,
  contractName?: string
): string {
  if (!error) {
    return "An unknown error occurred";
  }

  // Handle object errors more carefully
  let errorString: string;
  if (typeof error === "object") {
    const errorObj = error as any;
    if (errorObj.message && typeof errorObj.message === "string") {
      errorString = errorObj.message;
    } else if (errorObj.name && errorObj.message) {
      errorString = `${errorObj.name}: ${errorObj.message}`;
    } else {
      // Fallback: try to stringify but avoid [object Object]
      try {
        const stringified = JSON.stringify(error);
        errorString =
          stringified === "{}" || stringified === '{""}'
            ? "Unknown error"
            : stringified;
      } catch {
        errorString = "An unexpected error occurred";
      }
    }
  } else {
    errorString = String(error);
  }

  // Try to extract error code from Soroban contract error format
  // Format: "Error(Contract, #<code>)"
  const contractErrorMatch = errorString.match(/Error\(Contract,\s*#(\d+)\)/);
  if (contractErrorMatch) {
    const errorCode = parseInt(contractErrorMatch[1], 10);

    // Try contract-specific lookup first if contract name is provided or can be inferred
    const inferredContract =
      contractName || extractContractNameFromError(errorString);
    if (inferredContract) {
      const contractError = getContractError(inferredContract, errorCode);
      if (contractError) {
        return contractError.message;
      }
    }

    // Fall back to flattened lookup (backward compatibility)
    if (isValidErrorCode(errorCode)) {
      return CONTRACT_ERRORS[errorCode].message;
    }

    return `Contract error #${errorCode}`;
  }

  // Try to extract from HostError format
  // Format: "HostError: Error(Contract, #<code>)"
  const hostErrorMatch = errorString.match(
    /HostError:.*Error\(Contract,\s*#(\d+)\)/
  );
  if (hostErrorMatch) {
    const errorCode = parseInt(hostErrorMatch[1], 10);

    // Try contract-specific lookup first
    const inferredContract =
      contractName || extractContractNameFromError(errorString);
    if (inferredContract) {
      const contractError = getContractError(inferredContract, errorCode);
      if (contractError) {
        return contractError.message;
      }
    }

    // Fall back to flattened lookup
    if (isValidErrorCode(errorCode)) {
      return CONTRACT_ERRORS[errorCode].message;
    }

    return `Contract error #${errorCode}`;
  }

  // Check for simulation failure
  if (errorString.includes("simulation failed")) {
    // Try to extract the inner error
    const innerMatch = errorString.match(/Error\(Contract,\s*#(\d+)\)/);
    if (innerMatch) {
      const errorCode = parseInt(innerMatch[1], 10);

      // Try contract-specific lookup
      const inferredContract =
        contractName || extractContractNameFromError(errorString);
      if (inferredContract) {
        const contractError = getContractError(inferredContract, errorCode);
        if (contractError) {
          return contractError.message;
        }
      }

      // Fall back to flattened lookup
      if (isValidErrorCode(errorCode)) {
        return CONTRACT_ERRORS[errorCode].message;
      }
    }
    return "Transaction simulation failed. Please check your inputs and try again.";
  }

  // Check for common wallet errors
  if (
    errorString.toLowerCase().includes("user rejected") ||
    errorString.toLowerCase().includes("user denied") ||
    errorString.toLowerCase().includes("cancelled")
  ) {
    return "Transaction was cancelled by user";
  }

  if (
    errorString.toLowerCase().includes("insufficient funds") ||
    errorString.toLowerCase().includes("insufficient balance")
  ) {
    return "Insufficient funds for this transaction";
  }

  if (
    errorString.toLowerCase().includes("network") ||
    errorString.toLowerCase().includes("timeout")
  ) {
    return "Network error. Please check your connection and try again.";
  }

  // Return a sanitized version of the error message
  // Remove technical details that might confuse users
  const cleanedError = errorString
    .replace(/Error:/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  // If the error is too long or technical, return a generic message
  if (
    cleanedError.length > 150 ||
    cleanedError.includes("0x") ||
    cleanedError.includes("wasm")
  ) {
    return "Transaction failed. Please try again or contact support if the issue persists.";
  }

  // Final safety check: ensure we never return something that would display as "[object Object]"
  const finalError = cleanedError || "An unexpected error occurred";
  if (finalError === "[object Object]" || finalError.includes("[object ")) {
    return "Transaction failed. Please try again.";
  }

  return finalError;
}

/**
 * Get the error code name from a contract error
 * @param error - The error object from a failed contract call
 * @returns The error code name or null if not found
 */
export function getContractErrorCode(error: unknown): string | null {
  if (!error) return null;

  const errorString = String(error);
  const match = errorString.match(/Error\(Contract,\s*#(\d+)\)/);

  if (match) {
    const errorCode = parseInt(match[1], 10);
    if (isValidErrorCode(errorCode)) {
      return CONTRACT_ERRORS[errorCode].code;
    }
  }

  return null;
}

/**
 * Check if an error is a specific contract error
 * @param error - The error object from a failed contract call
 * @param errorCode - The error code to check for
 * @returns True if the error matches the specified code
 */
export function isContractError(
  error: unknown,
  errorCode: ContractErrorCode
): boolean {
  if (!error) return false;

  const errorString = String(error);
  const match = errorString.match(/Error\(Contract,\s*#(\d+)\)/);

  if (match) {
    const extractedCode = parseInt(match[1], 10);
    return extractedCode === errorCode;
  }

  return false;
}

/**
 * Check if an error is a user cancellation/rejection
 * @param error - The error object from a failed transaction
 * @returns True if the error was caused by user cancellation
 */
export function isUserCancellationError(error: unknown): boolean {
  if (!error) return false;

  const errorString = String(error).toLowerCase();

  // Common wallet rejection patterns
  const cancellationPatterns = [
    "user rejected",
    "user denied",
    "user declined",
    "cancelled",
    "canceled",
    "rejected the request",
    "user canceled",
    "user cancelled",
    "action_cancelled",
    "request rejected",
    "transaction rejected",
    "signature rejected",
    // Wallet-specific error codes/messages
    "4001", // MetaMask user rejection code
    "-32000", // Generic user rejection
    "-32603", // Internal error that might be user cancellation
  ];

  return cancellationPatterns.some((pattern) => errorString.includes(pattern));
}

/**
 * Extract error message, returning null for user cancellations
 * Useful for notification systems where user cancellation shouldn't trigger a notification
 * @param error - The error object from a failed contract call
 * @param contractName - Optional contract name to narrow down error lookup
 * @returns A user-friendly error message, or null if user cancelled
 */
export function extractContractErrorOrNull(
  error: unknown,
  contractName?: string
): string | null {
  if (isUserCancellationError(error)) {
    return null;
  }

  return extractContractError(error, contractName);
}
