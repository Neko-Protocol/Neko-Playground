import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SESSION_TTL_SECONDS } from "./constants";

export interface SessionPayload {
  publicKey: string;
  exp: number;
  jti: string;
}

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SESSION_SECRET must be set and at least 32 characters"
    );
  }
  return secret;
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function issueSession({
  publicKey,
  ttlSeconds = SESSION_TTL_SECONDS,
}: {
  publicKey: string;
  ttlSeconds?: number;
}): string {
  const payload: SessionPayload = {
    publicKey,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    jti: randomBytes(16).toString("base64url"),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySession(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = signPayload(encodedPayload);
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expectedBuf.length ||
    !timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SessionPayload;

    if (!payload.publicKey || !payload.exp || !payload.jti) {
      return null;
    }

    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
