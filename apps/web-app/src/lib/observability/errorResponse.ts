/**
 * Shared API error → HTTP response helper (#318).
 *
 * Logs the full error server-side (with correlation id + safe context) and
 * returns a client-safe message. Raw `err.message` is never forwarded unless
 * the error is explicitly marked client-safe.
 */

import { NextResponse } from "next/server";
import { logger } from "./logger";
import { redactValue } from "./redact";
import {
  REQUEST_ID_HEADER,
  normalizeRequestId,
  resolveRequestId,
} from "./requestId";

export {
  REQUEST_ID_HEADER,
  REQUEST_ID_HEADER_ALT,
  resolveRequestId,
} from "./requestId";

export class ClientSafeError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly clientSafe = true as const;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = "ClientSafeError";
    this.status = status;
    this.code = code;
  }
}

export function isClientSafeError(
  err: unknown
): err is ClientSafeError & { message: string } {
  if (!err || typeof err !== "object") return false;
  if (err instanceof ClientSafeError) return true;
  return (err as { clientSafe?: boolean }).clientSafe === true;
}

export function withRequestIdHeaders(
  requestId: string,
  init?: HeadersInit
): Headers {
  const headers = new Headers(init);
  headers.set(REQUEST_ID_HEADER, requestId);
  return headers;
}

export interface ErrorResponseOptions {
  req?: Request | null;
  requestId?: string;
  route?: string;
  context?: Record<string, unknown>;
  fallbackMessage?: string;
  status?: number;
}

/**
 * Log `err` and return a JSON NextResponse that never leaks raw internals
 * unless the error is client-safe.
 */
export function errorResponse(
  err: unknown,
  options: ErrorResponseOptions = {}
): NextResponse {
  const requestId = options.requestId
    ? normalizeRequestId(options.requestId)
    : resolveRequestId(options.req);
  const route = options.route || "unknown";
  const safeContext = options.context
    ? (redactValue(options.context) as Record<string, unknown>)
    : undefined;

  logger.error("api_route_error", {
    ...(safeContext || {}),
    requestId,
    route,
    err,
  });

  if (isClientSafeError(err)) {
    const status =
      typeof (err as ClientSafeError).status === "number"
        ? (err as ClientSafeError).status
        : options.status || 400;
    const body: Record<string, unknown> = {
      error: err.message,
      requestId,
    };
    if ((err as ClientSafeError).code) {
      body.code = (err as ClientSafeError).code;
    }
    return NextResponse.json(body, {
      status,
      headers: withRequestIdHeaders(requestId),
    });
  }

  const status = options.status || 500;
  return NextResponse.json(
    {
      error:
        options.fallbackMessage ||
        "An unexpected error occurred. Please try again.",
      requestId,
    },
    {
      status,
      headers: withRequestIdHeaders(requestId),
    }
  );
}

/** Attach request id header to a successful response. */
export function okWithRequestId(
  body: unknown,
  requestId: string,
  init?: { status?: number; headers?: HeadersInit }
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: withRequestIdHeaders(requestId, init?.headers),
  });
}
