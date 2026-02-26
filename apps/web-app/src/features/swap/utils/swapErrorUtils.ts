/**
 * Swap Error Utilities
 *
 * Centralises user-rejection detection for all swap execution paths.
 * Instead of reimplementing the same string-matching logic in every call
 * site, every swap handler should funnel caught errors through
 * `handleSwapError` so rejection detection is always consistent.
 */

import { isUserCancellationError } from "@/lib/helpers/contractErrors";

/**
 * The sentinel error message thrown whenever the user explicitly cancels a
 * wallet interaction.  Callers that need to suppress UI notifications for
 * intentional cancellations can match against this constant.
 */

export const USER_REJECTED_MESSAGE = "USER_REJECTED" as const;

/**
 * Normalise an error thrown during swap execution.
 *
 * - If `error` is a user-cancellation (wallet reject / user denied / etc.)
 *   this function throws `new Error("USER_REJECTED")` so every call site
 *   sees the same sentinel value.
 * - Otherwise the original error is re-thrown unchanged so that upstream
 *   handlers receive the real cause.
 *
 * @param error - The value caught in a `catch` block.
 * @throws {Error} Always – either `USER_REJECTED` or the original error.
 */
export function handleSwapError(error: unknown): never {
  if (isUserCancellationError(error)) {
    throw new Error(USER_REJECTED_MESSAGE);
  }
  // Re-throw the original error so callers preserve the original stack /
  // message for non-rejection failures.
  if (error instanceof Error) {
    throw error;
  }
  throw new Error(String(error));
}
