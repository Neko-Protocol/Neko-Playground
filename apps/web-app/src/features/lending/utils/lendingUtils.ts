/**
 * Lending feature UI utilities
 * Pure helpers for bToken conversion and formatting
 */

/**
 * Calculate bTokens needed to withdraw a given amount of tokens.
 * From contract: tokens = (bTokens × bTokenRate) / SCALAR_9
 * So: bTokens = tokens / bTokenRate (bTokenRate is already human-readable).
 */
export function calculateBTokensFromTokens(
  tokensAmount: string,
  bTokenRate: string
): string {
  if (
    !tokensAmount ||
    parseFloat(tokensAmount) <= 0 ||
    !bTokenRate ||
    parseFloat(bTokenRate) <= 0
  ) {
    return "0";
  }

  const tokens = parseFloat(tokensAmount);
  const rate = parseFloat(bTokenRate);
  const bTokens = tokens / rate;
  return bTokens.toFixed(7);
}
