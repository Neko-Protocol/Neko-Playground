import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation/parse";
import { StellarAddressSchema } from "@/lib/validation/schemas";
import { verifyChallenge } from "@/lib/event-platform/auth/challenge";
import {
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/event-platform/auth/session";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  walletAddress: StellarAddressSchema,
  message: z.string().min(1),
  signature: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, BodySchema);
  if ("error" in parsed) return parsed.error;

  try {
    const { walletAddress, message, signature } = parsed.data;
    const valid = await verifyChallenge(walletAddress, message, signature);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid or expired signature" },
        { status: 401 }
      );
    }

    const token = await createSession(walletAddress);
    const response = NextResponse.json({ ok: true, walletAddress });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
