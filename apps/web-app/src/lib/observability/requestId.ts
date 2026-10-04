import { redactString } from "./redact";

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_HEADER_ALT = "x-correlation-id";

/**
 * Keep ordinary correlation IDs, but do not turn a wallet, token, or XDR into
 * log metadata. Generate a replacement before forwarding the request so the
 * route, response, and logger all receive the same safe value.
 *
 * Web Crypto is available in both the Next.js edge and Node runtimes. Keep
 * this middleware helper independent of the route-handler logging imports.
 */
export function normalizeRequestId(value?: string | null): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (candidate && redactString(candidate) === candidate) {
    return candidate.slice(0, 128);
  }
  return crypto.randomUUID();
}

export function resolveRequestId(req?: Request | null): string {
  return normalizeRequestId(
    req?.headers.get(REQUEST_ID_HEADER) ||
      req?.headers.get(REQUEST_ID_HEADER_ALT)
  );
}
