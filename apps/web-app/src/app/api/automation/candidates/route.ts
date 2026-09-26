import { NextRequest, NextResponse } from "next/server";
import type { VenueCandidate } from "@/features/automation/types/automation";
import { buildCandidates } from "@/lib/services/candidates.service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/automation/candidates?walletAddress=G...
 *
 * Returns the current VenueCandidate list for the caller's wallet, read
 * from live contract / service sources. Every venue the protocol supports
 * is returned; venues whose reads failed are marked `availability:
 * "unavailable"` with a reason rather than being dropped.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const walletAddress = searchParams.get("walletAddress");

  if (!walletAddress) {
    return NextResponse.json(
      { error: "walletAddress query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const candidates: VenueCandidate[] = await buildCandidates(walletAddress);
    return NextResponse.json(candidates);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
