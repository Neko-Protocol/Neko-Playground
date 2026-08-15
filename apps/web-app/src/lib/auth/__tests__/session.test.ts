import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { issueSession, verifySession } from "@/lib/auth/session";

describe("session", () => {
  const originalSecret = process.env.AUTH_SESSION_SECRET;

  beforeEach(() => {
    process.env.AUTH_SESSION_SECRET =
      "test-secret-key-at-least-32-characters-long";
  });

  afterEach(() => {
    process.env.AUTH_SESSION_SECRET = originalSecret;
  });

  it("issues and verifies a session token", () => {
    const publicKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const token = issueSession({ publicKey, ttlSeconds: 3600 });
    const payload = verifySession(token);

    expect(payload?.publicKey).toBe(publicKey);
    expect(payload?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejects tampered tokens", () => {
    const token = issueSession({
      publicKey: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    });
    const tampered = `${token}x`;
    expect(verifySession(tampered)).toBeNull();
  });
});
