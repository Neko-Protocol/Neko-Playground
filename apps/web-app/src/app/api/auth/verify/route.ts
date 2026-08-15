import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@stellar/stellar-sdk";
import { issueSession } from "@/lib/auth/session";
import { takeNonce } from "@/lib/auth/nonceStore";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "@/lib/auth/constants";
import { parseJsonBody } from "@/lib/validation/parse";
import { VerifyBodySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, VerifyBodySchema);
  if ("error" in parsed) return parsed.error;

  const { publicKey, nonce, signature } = parsed.data;
  const record = await takeNonce(nonce);

  if (!record || record.publicKey !== publicKey) {
    return NextResponse.json(
      { error: "Invalid or expired challenge" },
      { status: 401 }
    );
  }

  let signatureBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signature, "base64");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const verified = Keypair.fromPublicKey(publicKey).verify(
    Buffer.from(record.message, "utf8"),
    signatureBuffer
  );

  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const token = issueSession({ publicKey, ttlSeconds: SESSION_TTL_SECONDS });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}
