type InterestRateResult =
  | { tag?: string; values?: unknown[]; unwrap?: () => bigint }
  | bigint
  | number
  | string
  | null
  | undefined;

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
    } catch {}
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

  return rateValue / 100_000;
}
