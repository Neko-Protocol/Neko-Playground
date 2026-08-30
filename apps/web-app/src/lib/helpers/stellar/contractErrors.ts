import {
  CONTRACT_ERRORS,
  ContractErrorCode,
  isValidErrorCode,
  getContractError,
} from "@/lib/constants/contracts";

function extractContractNameFromError(errorString: string): string | null {
  const contractPatterns = [
    { pattern: /rwa-lending/i, name: "rwa-lending" },
    { pattern: /rwa-token/i, name: "rwa-token" },
    { pattern: /rwa-oracle/i, name: "rwa-oracle" },
    { pattern: /lending/i, name: "rwa-lending" },
    { pattern: /token/i, name: "rwa-token" },
    { pattern: /oracle/i, name: "rwa-oracle" },
  ];

  for (const { pattern, name } of contractPatterns) {
    if (pattern.test(errorString)) {
      return name;
    }
  }

  return null;
}

export function extractContractError(
  error: unknown,
  contractName?: string
): string {
  if (!error) {
    return "An unknown error occurred";
  }

  let errorString: string;
  if (typeof error === "object") {
    const errorObj = error as Record<string, unknown>;
    if (typeof errorObj.message === "string") {
      errorString = errorObj.message;
    } else if (errorObj.name && errorObj.message) {
      errorString = `${String(errorObj.name)}: ${String(errorObj.message)}`;
    } else {
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

  const contractErrorMatch = errorString.match(/Error\(Contract,\s*#(\d+)\)/);
  if (contractErrorMatch) {
    const errorCode = parseInt(contractErrorMatch[1], 10);

    const inferredContract =
      contractName || extractContractNameFromError(errorString);
    if (inferredContract) {
      const contractError = getContractError(inferredContract, errorCode);
      if (contractError) {
        return contractError.message;
      }
    }

    if (isValidErrorCode(errorCode)) {
      return CONTRACT_ERRORS[errorCode].message;
    }

    return `Contract error #${errorCode}`;
  }

  const hostErrorMatch = errorString.match(
    /HostError:.*Error\(Contract,\s*#(\d+)\)/
  );
  if (hostErrorMatch) {
    const errorCode = parseInt(hostErrorMatch[1], 10);

    const inferredContract =
      contractName || extractContractNameFromError(errorString);
    if (inferredContract) {
      const contractError = getContractError(inferredContract, errorCode);
      if (contractError) {
        return contractError.message;
      }
    }

    if (isValidErrorCode(errorCode)) {
      return CONTRACT_ERRORS[errorCode].message;
    }

    return `Contract error #${errorCode}`;
  }

  if (errorString.includes("simulation failed")) {
    const innerMatch = errorString.match(/Error\(Contract,\s*#(\d+)\)/);
    if (innerMatch) {
      const errorCode = parseInt(innerMatch[1], 10);

      const inferredContract =
        contractName || extractContractNameFromError(errorString);
      if (inferredContract) {
        const contractError = getContractError(inferredContract, errorCode);
        if (contractError) {
          return contractError.message;
        }
      }

      if (isValidErrorCode(errorCode)) {
        return CONTRACT_ERRORS[errorCode].message;
      }
    }
    return "Transaction simulation failed. Please check your inputs and try again.";
  }

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

  const cleanedError = errorString
    .replace(/Error:/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    cleanedError.length > 150 ||
    cleanedError.includes("0x") ||
    cleanedError.includes("wasm")
  ) {
    return "Transaction failed. Please try again or contact support if the issue persists.";
  }

  const finalError = cleanedError || "An unexpected error occurred";
  if (finalError === "[object Object]" || finalError.includes("[object ")) {
    return "Transaction failed. Please try again.";
  }

  return finalError;
}

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

export function isUserCancellationError(error: unknown): boolean {
  if (!error) return false;

  const errorString = String(error).toLowerCase();

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

    "4001", // MetaMask user rejection code
    "-32000", // Generic user rejection
    "-32603", // Internal error that might be user cancellation
  ];

  return cancellationPatterns.some((pattern) => errorString.includes(pattern));
}

export function extractContractErrorOrNull(
  error: unknown,
  contractName?: string
): string | null {
  if (isUserCancellationError(error)) {
    return null;
  }

  return extractContractError(error, contractName);
}

export type MappedContractError =
  | { kind: "withdrawal_queue_not_expired"; message: string }
  | { kind: "insufficient_balance"; message: string }
  | { kind: "unauthorized"; message: string }
  | { kind: "other"; message: string; code?: number };

const WITHDRAWAL_QUEUE_NOT_EXPIRED_CODE = 72;

const INSUFFICIENT_BALANCE_CODE_NAMES = new Set([
  "InsufficientBalance",
  "InsufficientPoolBalance",
  "InsufficientLiquidity",
  "InsufficientBTokenBalance",
  "InsufficientDepositAmount",
  "InsufficientWithdrawalBalance",
  "InsufficientCollateral",
  "InsufficientBorrowLimit",
  "InsufficientDTokenBalance",
  "InsufficientDebtToRepay",
  "InsufficientBackstopDeposit",
  "InsufficientAllowance",
]);

function extractNumericErrorCode(error: unknown): number | null {
  if (!error) return null;
  const errorString = String(error);
  const match = errorString.match(/Error\(Contract,\s*#(\d+)\)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

/**
 * Classifies a contract error into a typed discriminant for UI handling.
 */
export function mapContractError(
  error: unknown,
  contractName?: string
): MappedContractError | null {
  if (!error || isUserCancellationError(error)) return null;

  const numericCode = extractNumericErrorCode(error);
  const message = extractContractError(error, contractName);

  if (numericCode === WITHDRAWAL_QUEUE_NOT_EXPIRED_CODE) {
    return { kind: "withdrawal_queue_not_expired", message };
  }

  const inferredContract =
    contractName || extractContractNameFromError(String(error));
  if (numericCode != null && inferredContract) {
    const contractError = getContractError(inferredContract, numericCode);
    if (contractError) {
      if (contractError.code === "WithdrawalQueueNotExpired") {
        return { kind: "withdrawal_queue_not_expired", message };
      }
      if (
        contractError.code === "Unauthorized" ||
        contractError.code === "NotAuthorized"
      ) {
        return { kind: "unauthorized", message: contractError.message };
      }
      if (INSUFFICIENT_BALANCE_CODE_NAMES.has(contractError.code)) {
        return { kind: "insufficient_balance", message };
      }
    }
  }

  if (numericCode != null && isValidErrorCode(numericCode)) {
    const info = CONTRACT_ERRORS[numericCode];
    if (info.code === "WithdrawalQueueNotExpired") {
      return { kind: "withdrawal_queue_not_expired", message };
    }
    if (info.code === "Unauthorized") {
      return { kind: "unauthorized", message };
    }
    if (INSUFFICIENT_BALANCE_CODE_NAMES.has(info.code)) {
      return { kind: "insufficient_balance", message };
    }
    return { kind: "other", message, code: numericCode };
  }

  const errorString = String(error);
  if (errorString.includes("WithdrawalQueueNotExpired")) {
    return { kind: "withdrawal_queue_not_expired", message };
  }
  if (/\b(Unauthorized|NotAuthorized)\b/.test(errorString)) {
    return { kind: "unauthorized", message };
  }
  if (/\bInsufficient\w*\b/.test(errorString)) {
    return { kind: "insufficient_balance", message };
  }

  if (numericCode != null) {
    return { kind: "other", message, code: numericCode };
  }

  return { kind: "other", message };
}
