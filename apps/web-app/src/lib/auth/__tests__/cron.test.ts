import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/env.server", () => ({
  serverEnv: { CRON_SECRET: "this-is-a-32-character-test-secret!!" },
  requireServerEnv: vi.fn(),
}));

import { isAuthorizedCron } from "../cron";

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/vault/invest", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe("isAuthorizedCron", () => {
  it("returns true for the correct Bearer token", () => {
    expect(
      isAuthorizedCron(makeRequest("Bearer this-is-a-32-character-test-secret!!"))
    ).toBe(true);
  });

  it("returns false when Authorization header is absent", () => {
    expect(isAuthorizedCron(makeRequest())).toBe(false);
  });

  it("returns false for a wrong token", () => {
    expect(isAuthorizedCron(makeRequest("Bearer wrong-token"))).toBe(false);
  });

  it("returns false for a non-Bearer scheme", () => {
    expect(isAuthorizedCron(makeRequest("Basic dXNlcjpwYXNz"))).toBe(false);
  });

  it("returns false for a token differing by one character", () => {
    expect(
      isAuthorizedCron(makeRequest("Bearer this-is-a-32-character-test-secret!X"))
    ).toBe(false);
  });

  it("returns false for the x-vercel-cron spoofing header with no auth", () => {
    const req = new Request("http://localhost/api/vault/invest", {
      method: "POST",
      headers: { "x-vercel-cron": "1" },
    });
    expect(isAuthorizedCron(req)).toBe(false);
  });
});
