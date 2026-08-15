"use client";

import { getStellarWalletKit } from "@/lib/helpers/stellar/wallet/walletKit";

export class WalletAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WalletAuthError";
  }
}

export async function signAuthMessage(
  message: string,
  address: string
): Promise<string> {
  try {
    const { signMessage, isConnected } = await import("@stellar/freighter-api");
    if (await isConnected()) {
      const result = await signMessage(message, { address });
      if (result.error || !result.signedMessage) {
        throw new WalletAuthError(
          typeof result.error === "string"
            ? result.error
            : "Failed to sign authentication message"
        );
      }

      if (typeof result.signedMessage === "string") {
        return result.signedMessage;
      }

      return Buffer.from(result.signedMessage).toString("base64");
    }
  } catch (error) {
    if (error instanceof WalletAuthError) {
      throw error;
    }
  }

  const Kit = await getStellarWalletKit();
  const kitWithSign = Kit as typeof Kit & {
    signMessage?: (
      message: string,
      opts: { address: string }
    ) => Promise<{ signedMessage?: string | Uint8Array }>;
  };

  if (typeof kitWithSign.signMessage === "function") {
    const result = await kitWithSign.signMessage(message, { address });
    if (!result?.signedMessage) {
      throw new WalletAuthError("Failed to sign authentication message");
    }
    return typeof result.signedMessage === "string"
      ? result.signedMessage
      : Buffer.from(result.signedMessage).toString("base64");
  }

  throw new WalletAuthError(
    "Connected wallet does not support message signing"
  );
}

export async function authenticateWallet(
  publicKey: string,
  signFn: (message: string) => Promise<string> = (message) =>
    signAuthMessage(message, publicKey)
): Promise<void> {
  const challengeRes = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ publicKey }),
  });

  if (!challengeRes.ok) {
    throw new WalletAuthError("Failed to request authentication challenge");
  }

  const { nonce, message } = (await challengeRes.json()) as {
    nonce: string;
    message: string;
  };

  const signature = await signFn(message);

  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ publicKey, nonce, signature }),
  });

  if (!verifyRes.ok) {
    throw new WalletAuthError("Wallet authentication failed");
  }
}

export async function logoutWalletSession(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}
