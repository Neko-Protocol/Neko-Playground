import { NextRequest, NextResponse } from "next/server";
import type { RebalancePlan } from "@/features/automation/types/automation";
import { raiseEvent } from "@/lib/event-platform/outbox";

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

// Raises a durable event whenever a plan lands in "failed" — inert today
// (neither `confirm` nor `cancel` below produce that status; this stub has
// no real step-execution yet, per the "kick off step execution via a queue
// worker" TODO above), but it fires automatically the moment that worker
// exists, with no further change needed here. `walletAddress` is optional
// because RebalancePlan has no owner field at all in this stub — the client
// may supply it in the request body; without it, a failure has no wallet to
// notify and is skipped (see the PR description's known limitations).
async function raiseFailureEventIfNeeded(
  plan: RebalancePlan,
  walletAddress: string | undefined
): Promise<void> {
  if (plan.status !== "failed" || !walletAddress) return;
  await raiseEvent({
    source: "automation",
    walletAddress,
    dedupeKey: `plan-failed:${plan.id}`,
    eventType: "plan-failed",
    severity: "critical",
    payload: { planId: plan.id, strategyId: plan.strategyId },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    planId,
    strategyId: _strategyId,
    action,
    walletAddress,
  } = body as {
    planId: string;
    strategyId: string;
    action: "confirm" | "cancel";
    walletAddress?: string;
  };

  let plan = planStore.get(planId);

  if (!plan) {
    // Create a stub plan for demo if not found
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Checked against the plan as fetched, before confirm/cancel below
  // overwrite its status — this is what makes the hook observable at all: a
  // plan already marked "failed" by some other process (the future
  // step-execution worker) before this request arrived still gets reported,
  // even though confirm/cancel always assign their own terminal status next.
  await raiseFailureEventIfNeeded(plan, walletAddress);

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
