import { NextRequest, NextResponse } from "next/server";
import { getPlan, listPlans, savePlan } from "@/lib/automation/store";
import { requireSession } from "@/lib/auth/requireSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = requireSession(request);
  if (sessionResult.error) return sessionResult.error;

  const { searchParams } = new URL(request.url);
  const strategyId = searchParams.get("strategyId");
  const plans = await listPlans(sessionResult.session.publicKey, strategyId);
  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const sessionResult = requireSession(request);
  if (sessionResult.error) return sessionResult.error;

  const body = await request.json();
  const {
    planId,
    action,
  } = body as {
    planId: string;
    strategyId: string;
    action: "confirm" | "cancel";
  };

  const plan = await getPlan(sessionResult.session.publicKey, planId);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (action === "confirm") {
    const updated = { ...plan, status: "executing" as const };
    await savePlan(sessionResult.session.publicKey, updated);
    return NextResponse.json(updated);
  }

  if (action === "cancel") {
    const updated = { ...plan, status: "aborted" as const };
    await savePlan(sessionResult.session.publicKey, updated);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
