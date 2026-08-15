import { describe, expect, it } from "vitest";
import { putNonce, takeNonce } from "@/lib/auth/nonceStore";
import { buildAuthMessage } from "@/lib/auth/signMessage";

describe("nonceStore", () => {
  it("stores and consumes a nonce once", async () => {
    const publicKey = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
    const nonce = "test-nonce-value";
    const message = buildAuthMessage(publicKey, nonce);

    await putNonce(nonce, { publicKey, message });

    const first = await takeNonce(nonce);
    expect(first?.publicKey).toBe(publicKey);
    expect(first?.message).toBe(message);

    const second = await takeNonce(nonce);
    expect(second).toBeNull();
  });
});
