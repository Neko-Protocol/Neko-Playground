import { XLM_FEE_BUFFER } from "../constants/swapConfig";

/**
 * Computes the max spendable XLM for a swap input.
 *
 * `reserveAdjustedBalance` is the XLM balance already adjusted for the Stellar
 * minimum reserve (as returned by `useTokenBalance` for XLM). We subtract an
 * additional fee buffer so the user never submits a transaction they cannot pay
 * the network fee for.
 *
 * @returns A non-negative string representing the spendable amount.
 */
export function getSpendableXlmAmount(
  reserveAdjustedBalance: string | undefined
): string {
  const balance = parseFloat(reserveAdjustedBalance ?? "0");
  if (isNaN(balance) || balance <= 0) return "0";
  const spendable = Math.max(0, balance - XLM_FEE_BUFFER);
  // Return up to 7 decimal places (Stellar's precision)
  return parseFloat(spendable.toFixed(7)).toString();
}
