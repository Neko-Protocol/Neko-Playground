import { describe, expect, it } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { buildAuthMessage } from "@/lib/auth/signMessage";

describe("signMessage", () => {
  it("builds a domain-bound message", () => {
    const publicKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const message = buildAuthMessage(publicKey, "nonce-123");
    expect(message).toContain("neko.finance");
    expect(message).toContain(publicKey);
    expect(message).toContain("nonce-123");
  });

  it("verifies signatures for the issued message", () => {
    const keypair = Keypair.random();
    const nonce = "nonce-abc";
    const message = buildAuthMessage(keypair.publicKey(), nonce);
    const signature = keypair.sign(Buffer.from(message, "utf8"));

    const verified = Keypair.fromPublicKey(keypair.publicKey()).verify(
      Buffer.from(message, "utf8"),
      signature
    );

    expect(verified).toBe(true);
  });

  it("rejects signatures from a different key", () => {
    const keypair = Keypair.random();
    const other = Keypair.random();
    const message = buildAuthMessage(keypair.publicKey(), "nonce");
    const signature = other.sign(Buffer.from(message, "utf8"));

    const verified = Keypair.fromPublicKey(keypair.publicKey()).verify(
      Buffer.from(message, "utf8"),
      signature
    );

    expect(verified).toBe(false);
  });
});
