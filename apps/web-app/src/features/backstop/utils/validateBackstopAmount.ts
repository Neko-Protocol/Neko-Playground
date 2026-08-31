export type BackstopAmountAction = "deposit" | "queue" | "withdraw";

export interface ValidateBackstopAmountInput {
  action: BackstopAmountAction;
  amount: string;
  walletBalance: string;
  activeDepositAmount: string;
  queuedDepositAmount: string;
}

export type ValidateBackstopAmountResult =
  | { valid: true }
  | { valid: false; message: string };

function parsePositiveAmount(amount: string): number | null {
  const trimmed = amount.trim();
  if (!trimmed) return null;
  const value = parseFloat(trimmed);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function validateBackstopAmount(
  input: ValidateBackstopAmountInput
): ValidateBackstopAmountResult {
  const {
    action,
    amount,
    walletBalance,
    activeDepositAmount,
    queuedDepositAmount,
  } = input;
  const parsed = parsePositiveAmount(amount);

  if (parsed == null) {
    return {
      valid: false,
      message: "Enter an amount greater than zero.",
    };
  }

  if (action === "deposit") {
    const limit = parseFloat(walletBalance);
    if (parsed > limit) {
      return {
        valid: false,
        message: `Amount exceeds wallet balance (${walletBalance}).`,
      };
    }
    return { valid: true };
  }

  if (action === "queue") {
    const limit = parseFloat(activeDepositAmount);
    if (parsed > limit) {
      return {
        valid: false,
        message: `Amount exceeds active deposit (${activeDepositAmount}).`,
      };
    }
    return { valid: true };
  }

  const limit = parseFloat(queuedDepositAmount);
  if (parsed > limit) {
    return {
      valid: false,
      message: `Amount exceeds queued deposit (${queuedDepositAmount}).`,
    };
  }
  return { valid: true };
}
