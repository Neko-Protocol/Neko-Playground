import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthMessage } from "@/lib/auth/signMessage";
import { putNonce } from "@/lib/auth/nonceStore";
import { parseJsonBody } from "@/lib/validation/parse";
import { ChallengeBodySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, ChallengeBodySchema);
  if ("error" in parsed) return parsed.error;

  const { publicKey } = parsed.data;
  const nonce = randomBytes(32).toString("base64url");
  const message = buildAuthMessage(publicKey, nonce);

  await putNonce(nonce, { publicKey, message });

  return NextResponse.json({ nonce, message });
}
