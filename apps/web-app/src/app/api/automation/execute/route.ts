import { NextRequest, NextResponse } from "next/server";
import type { RebalancePlan } from "@/features/automation/types/automation";

// In-memory plan store for demo
declare global {
  // eslint-disable-next-line no-var
  var __automationPlans: Map<string, RebalancePlan> | undefined;
}
globalThis.__automationPlans ??= new Map<string, RebalancePlan>();
const planStore = globalThis.__automationPlans;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("strategyId");
  const plans = [...planStore.values()].filter(
    (p) => !strategyId || p.strategyId === strategyId
  );
  return NextResponse.json(plans);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    planId,
    strategyId: _strategyId,
    action,
  } = body as {
    planId: string;
    strategyId: string;
    action: "confirm" | "cancel";
  };

  let plan = planStore.get(planId);

  if (!plan) {
    // Create a stub plan for demo if not found
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  if (action === "confirm") {
    plan = { ...plan, status: "executing" };
    planStore.set(plan.id, plan);
    // In production: kick off step execution via a queue worker
    return NextResponse.json(plan);
  }

  if (action === "cancel") {
    plan = { ...plan, status: "aborted" };
    planStore.set(plan.id, plan);
    return NextResponse.json(plan);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
