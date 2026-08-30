import { describe, it, expect, beforeEach } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createChallenge, verifyChallenge } from "../challenge";
import {
  createFakeDb,
  type FakeDb,
} from "../../__tests__/testUtils/fakeSupabase";

describe("wallet auth challenge (SEP-10-lite)", () => {
  let db: FakeDb;
  let keypair: Keypair;
  const asClient = () => db as unknown as SupabaseClient;

  beforeEach(() => {
    db = createFakeDb();
    keypair = Keypair.random();
  });

  it("verifies a correctly signed challenge and consumes the nonce", async () => {
    const { message } = await createChallenge(keypair.publicKey(), asClient());
    const signature = keypair
      .sign(Buffer.from(message, "utf8"))
      .toString("base64");

    const valid = await verifyChallenge(
      keypair.publicKey(),
      message,
      signature,
      asClient()
    );
    expect(valid).toBe(true);

    const challengeRow = db.tables.wallet_auth_challenges[0];
    expect(challengeRow.consumed_at).toBeTruthy();
  });

  it("rejects a signature from the wrong keypair", async () => {
    const { message } = await createChallenge(keypair.publicKey(), asClient());
    const impostor = Keypair.random();
    const signature = impostor
      .sign(Buffer.from(message, "utf8"))
      .toString("base64");

    const valid = await verifyChallenge(
      keypair.publicKey(),
      message,
      signature,
      asClient()
    );
    expect(valid).toBe(false);
  });

  it("rejects a tampered message", async () => {
    const { message } = await createChallenge(keypair.publicKey(), asClient());
    const signature = keypair
      .sign(Buffer.from(message, "utf8"))
      .toString("base64");

    const valid = await verifyChallenge(
      keypair.publicKey(),
      message.replace("Nonce:", "Nonce: tampered-"),
      signature,
      asClient()
    );
    expect(valid).toBe(false);
  });

  it("rejects replaying an already-consumed nonce", async () => {
    const { message } = await createChallenge(keypair.publicKey(), asClient());
    const signature = keypair
      .sign(Buffer.from(message, "utf8"))
      .toString("base64");

    const first = await verifyChallenge(
      keypair.publicKey(),
      message,
      signature,
      asClient()
    );
    const replay = await verifyChallenge(
      keypair.publicKey(),
      message,
      signature,
      asClient()
    );

    expect(first).toBe(true);
    expect(replay).toBe(false);
  });

  it("rejects an expired challenge", async () => {
    const { message } = await createChallenge(keypair.publicKey(), asClient());
    const signature = keypair
      .sign(Buffer.from(message, "utf8"))
      .toString("base64");

    db.tables.wallet_auth_challenges[0].expires_at = new Date(
      Date.now() - 1000
    ).toISOString();

    const valid = await verifyChallenge(
      keypair.publicKey(),
      message,
      signature,
      asClient()
    );
    expect(valid).toBe(false);
  });
});
