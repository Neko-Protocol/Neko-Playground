import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { verifyCronBearer } from "@/lib/cronAuth";

function req(headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/vault/invest", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "super-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyCronBearer", () => {
  it("accepts a matching Bearer token", () => {
    expect(
      verifyCronBearer(req({ Authorization: "Bearer super-secret" }))
    ).toBe(true);
  });

  it("rejects missing Authorization", () => {
    expect(verifyCronBearer(req())).toBe(false);
  });

  it("rejects a wrong token", () => {
    expect(verifyCronBearer(req({ Authorization: "Bearer nope" }))).toBe(false);
  });

  it("rejects non-Bearer schemes", () => {
    expect(verifyCronBearer(req({ Authorization: "Basic super-secret" }))).toBe(
      false
    );
  });

  it("rejects when CRON_SECRET is unset", () => {
    vi.stubEnv("CRON_SECRET", "");
    delete process.env.CRON_SECRET;
    expect(
      verifyCronBearer(req({ Authorization: "Bearer super-secret" }))
    ).toBe(false);
  });

  it("ignores x-vercel-cron entirely", () => {
    expect(verifyCronBearer(req({ "x-vercel-cron": "1" }))).toBe(false);
  });
});
