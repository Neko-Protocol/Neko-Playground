import { NextRequest, NextResponse } from "next/server";
import type { RebalancePlan } from "@/features/automation/types/automation";
import {
  confirmPlan,
  cancelPlan,
  listPlansForWallet,
} from "@/lib/jobs/automation/ledger";
import {
  JobNotFoundError,
  JobOwnershipError,
  LeaseNotAcquiredError,
} from "@/lib/jobs/errors";
import {
  MissingWalletAddressError,
  requireWalletAddress,
} from "@/lib/jobs/walletAuth";
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
  try {
    const walletAddress = requireWalletAddress(
      searchParams.get("walletAddress")
    );
    const plans = await listPlansForWallet(strategyId, walletAddress);
    return NextResponse.json(plans);
  } catch (err) {
    if (err instanceof MissingWalletAddressError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
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
    plan,
    action,
    walletAddress: rawWalletAddress,
    walletAddress,
  } = body as {
    planId?: string;
    plan?: RebalancePlan;
    action: "confirm" | "cancel";
    walletAddress?: string;
  };

  try {
    const walletAddress = requireWalletAddress(rawWalletAddress);

    if (action === "confirm") {
      if (!plan) {
        return NextResponse.json(
          { error: "plan is required" },
          { status: 400 }
        );
      }
      const strategyName =
        typeof body.strategyName === "string" ? body.strategyName : "Strategy";
      const updated = await confirmPlan(plan, walletAddress, strategyName);
      return NextResponse.json(updated);
    }

    if (action === "cancel") {
      if (!planId) {
        return NextResponse.json(
          { error: "planId is required" },
          { status: 400 }
        );
      }
      const updated = await cancelPlan(planId, walletAddress);
      return NextResponse.json(updated);
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

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    if (err instanceof MissingWalletAddressError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof JobOwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof JobNotFoundError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    if (err instanceof LeaseNotAcquiredError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
