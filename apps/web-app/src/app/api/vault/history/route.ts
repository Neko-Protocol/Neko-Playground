import { NextResponse } from "next/server";
import { listVaultRunHistory } from "@/lib/vault/investLedger";
import { errorResponse } from "@/lib/observability";

const ROUTE = "/api/vault/history";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const entries = await listVaultRunHistory();
    return NextResponse.json([...entries].reverse());
  } catch (err) {
    return errorResponse(err, { req: request, route: ROUTE, status: 500 });
  }
}
