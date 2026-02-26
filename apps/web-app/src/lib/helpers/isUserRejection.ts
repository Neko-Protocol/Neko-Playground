/**
 * Returns true if the error represents a user-initiated wallet rejection/cancellation.
 * Used across EVM hooks and services to avoid surfacing cancellations as errors.
 */
export function isUserRejection(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  return (
    lower.includes("user denied") ||
    lower.includes("user rejected") ||
    lower.includes("user cancelled") ||
    lower.includes("user canceled") ||
    lower.includes("rejected by user") ||
    lower.includes("denied by user") ||
    lower.includes("action_cancelled") ||
    message.includes("4001")
  );
}
