import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "./lib/observability/requestId";

/**
 * Ensure every /api response carries a correlation id (#318).
 * Generates one when the client did not send it, and forwards the same value
 * on both the request (for route handlers) and the response.
 */
export function middleware(request: NextRequest) {
  const requestId = resolveRequestId(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
