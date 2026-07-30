import { NextRequest, NextResponse } from "next/server";
import { listHistory } from "@/lib/automation/store";
import { requireSession } from "@/lib/auth/requireSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = requireSession(request);
  if (sessionResult.error) return sessionResult.error;

  const { searchParams } = new URL(request.url);
  const strategyId = searchParams.get("strategyId");
  const filtered = await listHistory(
    sessionResult.session.publicKey,
    strategyId
  );
  return NextResponse.json([...filtered].reverse());
}
