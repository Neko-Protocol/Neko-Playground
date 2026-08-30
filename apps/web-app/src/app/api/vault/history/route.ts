import { NextResponse } from "next/server";
import { listVaultRunHistory } from "@/lib/vault/investLedger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await listVaultRunHistory();
    return NextResponse.json([...entries].reverse());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
