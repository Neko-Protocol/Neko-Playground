import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isAuthEnforced } from "./config";
import { SESSION_COOKIE_NAME } from "./constants";
import { UnauthorizedError } from "./errors";
import { verifySession } from "./session";

export interface AuthenticatedSession {
  publicKey: string;
}

export type SessionResult =
  | { session: AuthenticatedSession; error?: undefined }
  | { session?: undefined; error: NextResponse };

export function requireSession(request: NextRequest): SessionResult {
  if (!isAuthEnforced()) {
    return { session: { publicKey: "__dev_unauthenticated__" } };
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const payload = verifySession(token);
  if (!payload) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session: { publicKey: payload.publicKey } };
}

export function getSessionOrThrow(request: NextRequest): AuthenticatedSession {
  const result = requireSession(request);
  if (result.error) {
    throw new UnauthorizedError();
  }
  return result.session;
}
