/**
 * Shared lending/borrowing utilities
 * Used by useBorrowPools, useLendingPools, and other lending-related code
 */

/** Contract result shape for get_interest_rate (Result<i128>) */
type InterestRateResult =
  | { tag?: string; values?: unknown[]; unwrap?: () => bigint }
  | bigint
  | number
  | string
  | null
  | undefined;

/**
 * Parse interest rate from RWA lending contract get_interest_rate result.
 * Rate is stored as basis points (e.g. 213 = 2.13%). Returns percentage.
 */
export function parseInterestRateFromContractResult(
  interestRateResult: InterestRateResult
): number {
  if (interestRateResult === null || interestRateResult === undefined) {
    return 0;
  }

  let rateValue = 0;
  const result = interestRateResult as {
    tag?: string;
    values?: unknown[];
    unwrap?: () => bigint;
  };

  if (typeof result.unwrap === "function") {
    try {
      const unwrapped = result.unwrap();
      rateValue = Number(unwrapped);
    } catch {
      // unwrap() failed, try other methods
    }
  } else if (
    result.tag === "Ok" &&
    Array.isArray(result.values) &&
    result.values.length > 0
  ) {
    const val = result.values[0];
    rateValue = typeof val === "bigint" ? Number(val) : Number(val);
  } else if (typeof interestRateResult === "bigint") {
    rateValue = Number(interestRateResult);
  } else if (typeof interestRateResult === "number") {
    rateValue = interestRateResult;
  } else if (typeof interestRateResult === "string") {
    rateValue = parseInt(interestRateResult, 10);
  }

  // Contract stores rate with 7 decimals (SCALAR_7 = 10_000_000)
  // e.g. 100_000 = 1%, so to get percentage: value / SCALAR_7 * 100 = value / 100_000
  return rateValue / 100_000;
}
