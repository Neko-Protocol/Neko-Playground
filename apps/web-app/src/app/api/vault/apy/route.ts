import { NextResponse } from "next/server";
import { getVaultApySnapshot } from "@/lib/services/vault-apy.service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const snapshot = await getVaultApySnapshot();
    if (!snapshot) {
      return NextResponse.json({ error: "Not configured" }, { status: 503 });
    }

    return NextResponse.json({
      vaultApy:
        snapshot.vaultApy !== null
          ? parseFloat(snapshot.vaultApy.toFixed(2))
          : null,
      strategies: snapshot.strategies.map((s) => ({
        name: s.name,
        apy: s.apy !== null ? parseFloat(s.apy.toFixed(2)) : null,
        weight: parseFloat((s.weight * 100).toFixed(1)),
      })),
      note: snapshot.note,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
