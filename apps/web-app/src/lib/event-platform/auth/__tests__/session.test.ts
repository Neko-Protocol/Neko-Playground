import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createSession,
  requireWalletSession,
  UnauthorizedError,
  SESSION_COOKIE_NAME,
} from "../session";
import {
  createFakeDb,
  type FakeDb,
} from "../../__tests__/testUtils/fakeSupabase";

function requestWithCookie(token?: string): Request {
  return new Request("https://example.com/api/events", {
    headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {},
  });
}

describe("requireWalletSession", () => {
  let db: FakeDb;
  const asClient = () => db as unknown as SupabaseClient;

  beforeEach(() => {
    db = createFakeDb();
  });

  it("resolves the wallet for a valid session token", async () => {
    const token = await createSession("GWALLET1", asClient());
    const wallet = await requireWalletSession(
      requestWithCookie(token),
      asClient()
    );
    expect(wallet).toBe("GWALLET1");
  });

  it("throws Unauthorized when there is no session cookie", async () => {
    await expect(
      requireWalletSession(requestWithCookie(), asClient())
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws Unauthorized for a token that doesn't match any session", async () => {
    await expect(
      requireWalletSession(requestWithCookie("not-a-real-token"), asClient())
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws Unauthorized for a revoked session", async () => {
    const token = await createSession("GWALLET1", asClient());
    db.tables.wallet_sessions[0].revoked_at = new Date().toISOString();

    await expect(
      requireWalletSession(requestWithCookie(token), asClient())
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws Unauthorized for an expired session", async () => {
    const token = await createSession("GWALLET1", asClient());
    db.tables.wallet_sessions[0].expires_at = new Date(
      Date.now() - 1000
    ).toISOString();

    await expect(
      requireWalletSession(requestWithCookie(token), asClient())
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("never resolves one wallet's session token to a different wallet", async () => {
    const tokenA = await createSession("GWALLET_A", asClient());
    const tokenB = await createSession("GWALLET_B", asClient());

    const walletForA = await requireWalletSession(
      requestWithCookie(tokenA),
      asClient()
    );
    const walletForB = await requireWalletSession(
      requestWithCookie(tokenB),
      asClient()
    );

    expect(walletForA).toBe("GWALLET_A");
    expect(walletForB).toBe("GWALLET_B");
  });
});
