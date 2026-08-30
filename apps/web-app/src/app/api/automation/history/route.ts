import { NextRequest, NextResponse } from "next/server";
import { listHistoryForWallet } from "@/lib/jobs/automation/ledger";
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
    const entries = await listHistoryForWallet(walletAddress);
    const filtered = strategyId
      ? entries.filter((e) => e.strategyId === strategyId)
      : entries;
    return NextResponse.json(filtered);
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
