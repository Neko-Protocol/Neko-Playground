import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getFiatAccounts } from "@/app/api/anchor/[provider]/fiat-accounts/route";
import { bindCustomer } from "@/lib/auth/ownership";
import { issueSession } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const getFiatAccountsMock = vi.fn();

vi.mock("@/lib/anchors", () => ({
  getAnchorClient: () => ({
    getFiatAccounts: getFiatAccountsMock,
  }),
  AnchorError: class AnchorError extends Error {
    statusCode = 500;
    code = "ANCHOR_ERROR";
  },
}));

vi.mock("@/lib/auth/config", () => ({
  isAuthEnforced: () => true,
}));

describe("anchor route authorization", () => {
  const owner = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  const other = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
  const customerId = "cust-fiat-test";

  beforeEach(() => {
    vi.clearAllMocks();
    getFiatAccountsMock.mockResolvedValue([]);
    process.env.AUTH_SESSION_SECRET =
      "test-secret-key-at-least-32-characters-long";
  });

  function requestWithSession(publicKey: string, queryCustomerId: string) {
    const token = issueSession({ publicKey });
    const url = `http://localhost/api/anchor/etherfuse/fiat-accounts?customerId=${queryCustomerId}`;
    return new NextRequest(url, {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });
  }

  it("returns 401 without a session", async () => {
    const request = new NextRequest(
      "http://localhost/api/anchor/etherfuse/fiat-accounts?customerId=x"
    );
    const response = await getFiatAccounts(request, {
      params: Promise.resolve({ provider: "etherfuse" }),
    });
    expect(response.status).toBe(401);
    expect(getFiatAccountsMock).not.toHaveBeenCalled();
  });

  it("returns 403 for non-owner and skips upstream", async () => {
    await bindCustomer("etherfuse", customerId, owner);
    const response = await getFiatAccounts(
      requestWithSession(other, customerId),
      { params: Promise.resolve({ provider: "etherfuse" }) }
    );
    expect(response.status).toBe(403);
    expect(getFiatAccountsMock).not.toHaveBeenCalled();
  });

  it("returns 200 for owner", async () => {
    await bindCustomer("etherfuse", customerId, owner);
    const response = await getFiatAccounts(
      requestWithSession(owner, customerId),
      { params: Promise.resolve({ provider: "etherfuse" }) }
    );
    expect(response.status).toBe(200);
    expect(getFiatAccountsMock).toHaveBeenCalledOnce();
  });
});
