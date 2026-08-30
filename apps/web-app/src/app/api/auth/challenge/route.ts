import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation/parse";
import { StellarAddressSchema } from "@/lib/validation/schemas";
import { createChallenge } from "@/lib/event-platform/auth/challenge";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ walletAddress: StellarAddressSchema });

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, BodySchema);
  if ("error" in parsed) return parsed.error;

  try {
    const challenge = await createChallenge(parsed.data.walletAddress);
    return NextResponse.json(challenge);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
