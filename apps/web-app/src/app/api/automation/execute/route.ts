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
