import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCoordinatorLedgerStore } from "@/lib/coordinator/ledger";
import {
  createDelegationGrant,
  revokeDelegationGrant,
} from "@/lib/coordinator/delegation";

export const dynamic = "force-dynamic";

/**
 * Grant/revoke management for a position's deleveraging delegation (Scope
 * §5/§7). The client (features/strategies's leverage builder) has ALREADY
 * collected the user's wallet signatures for every unwind tranche via the
 * same SignFn the manual strategy engine uses — this route only persists
 * the resulting fully-signed payload into the durable coordinator ledger
 * and never itself asks for or holds a signature.
 */

const signedStepSchema = z.object({
  stepId: z.string(),
  operationType: z.enum(["repay", "withdrawCollateral"]),
  protocol: z.string(),
  poolType: z.enum(["blend", "neko", "soroswap", "custom"]),
  assetCode: z.string(),
  amount: z.string(),
  submissionMode: z.enum(["rpc", "soroswapApi"]),
  signedXdr: z.string().min(1),
  networkPassphrase: z.string().min(1),
});

const trancheSchema = z.object({
  id: z.string(),
  order: z.number(),
  collateralAmount: z.string(),
  debtAmount: z.string(),
  collateralPoolId: z.string().min(1),
  borrowPoolId: z.string().min(1),
  steps: z.array(signedStepSchema).min(1),
});

const createGrantSchema = z.object({
  positionId: z.string().min(1),
  walletAddress: z.string().min(1),
  assetCode: z.string().min(1),
  borrowAssetCode: z.string().min(1),
  tranches: z.array(trancheSchema).min(1),
  /** Milliseconds; defaults to 90 days if omitted. */
  validityMs: z.number().positive().optional(),
  guardConfig: z.object({
    deleverageThreshold: z.number().positive(),
    hysteresis: z.number().min(0),
  }),
});

const DEFAULT_VALIDITY_MS = 90 * 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const positionId = request.nextUrl.searchParams.get("positionId");
  if (!positionId) {
    return NextResponse.json(
      { error: "positionId query param is required" },
      { status: 400 }
    );
  }
  const grant = await getCoordinatorLedgerStore().getGrant(positionId);
  return NextResponse.json({ grant });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createGrantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid delegation grant payload",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }

  const store = getCoordinatorLedgerStore();
  const existing = await store.getGrant(parsed.data.positionId);
  if (existing && existing.status === "active") {
    return NextResponse.json(
      {
        error:
          "An active delegation already exists for this position — revoke it before granting a new one.",
      },
      { status: 409 }
    );
  }

  const grant = createDelegationGrant({
    positionId: parsed.data.positionId,
    walletAddress: parsed.data.walletAddress,
    assetCode: parsed.data.assetCode,
    borrowAssetCode: parsed.data.borrowAssetCode,
    tranches: parsed.data.tranches,
    validityMs: parsed.data.validityMs ?? DEFAULT_VALIDITY_MS,
    guardConfig: parsed.data.guardConfig,
  });
  await store.saveGrant(grant);

  return NextResponse.json({ grant }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const positionId = request.nextUrl.searchParams.get("positionId");
  if (!positionId) {
    return NextResponse.json(
      { error: "positionId query param is required" },
      { status: 400 }
    );
  }

  const store = getCoordinatorLedgerStore();
  const existing = await store.getGrant(positionId);
  if (!existing) {
    return NextResponse.json({ error: "No delegation found" }, { status: 404 });
  }

  const revoked = revokeDelegationGrant(existing);
  await store.saveGrant(revoked);
  return NextResponse.json({ grant: revoked });
}
