import { AdapterError } from "../orchestrator/types/errors";

export const DEFAULT_USER_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

type ErrorLike = {
  message?: unknown;
};

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

/**
 * Convert internal/wallet/orchestrator failures into a short message that is
 * safe to show in UI. AdapterError already carries a curated userMessage, so
 * preserve it instead of exposing its diagnostic wrapper.
 */
function getCuratedAdapterMessage(error: unknown): string | undefined {
  try {
    return error instanceof AdapterError
      ? nonEmptyString(error.userMessage)
      : undefined;
  } catch {
    return undefined;
  }
}

function getRawErrorMessage(error: unknown): string | undefined {
  try {
    if (error instanceof Error) return nonEmptyString(error.message);
    if (typeof error === "string") return nonEmptyString(error);
    if (error && typeof error === "object") {
      return nonEmptyString((error as ErrorLike).message);
    }
  } catch {
    // Hostile accessors or revoked proxies are unknown failures, not UI copy.
  }
  return undefined;
}

export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string = DEFAULT_USER_ERROR_MESSAGE
): string {
  const curated = getCuratedAdapterMessage(error);
  if (curated) return curated;

  const raw = getRawErrorMessage(error);

  if (!raw) return fallback;

  const message = raw.toLowerCase();

  if (
    /user.*(reject|declin|cancel)|request.*(reject|declin|cancel)|rejected by user/.test(
      message
    )
  ) {
    return "The wallet request was rejected.";
  }

  if (/timeout|timed out|deadline exceeded/.test(message)) {
    return "The request timed out. Please try again.";
  }

  if (
    /failed to fetch|fetch failed|network|connection|socket|rpc unavailable/.test(
      message
    )
  ) {
    return "Unable to reach the network. Check your connection and try again.";
  }

  if (/insufficient|not enough/.test(message)) {
    return "There are not enough funds to complete this action.";
  }

  return fallback;
}

/**
 * Central diagnostic path for failures that may be recovered from locally.
 * Returns the normalized message so callers that own UI can surface it.
 */
export function reportAppError(
  context: string,
  error: unknown,
  fallback?: string
): string {
  console.error(`[${context}]`, error);
  return getUserFacingErrorMessage(error, fallback);
}
