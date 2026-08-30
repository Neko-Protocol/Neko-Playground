import { NextRequest, NextResponse } from "next/server";
import { getEventPlatformDb } from "@/lib/event-platform/supabaseServer";
import {
  requireWalletSession,
  UnauthorizedError,
} from "@/lib/event-platform/auth/session";

export const dynamic = "force-dynamic";

/**
 * Lists this wallet's platform events and open incidents — the Alerts
 * view's data source, and what makes alert/incident history identical from
 * any browser/device, since it's read from the server, not localStorage.
 */
export async function GET(request: NextRequest) {
  try {
    const walletAddress = await requireWalletSession(request);
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source");

    const db = getEventPlatformDb();
    let query = db
      .from("platform_events")
      .select(
        "id, source, dedupe_key, event_type, severity, payload, incident_id, created_at"
      )
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(200);

    if (source) query = query.eq("source", source);

    const { data: events, error: eventsError } = await query;
    if (eventsError) throw new Error(eventsError.message);

    const { data: incidents, error: incidentsError } = await db
      .from("incidents")
      .select("id, title, severity, status, created_at")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(100);
    if (incidentsError) throw new Error(incidentsError.message);

    return NextResponse.json({
      events: events ?? [],
      incidents: incidents ?? [],
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
