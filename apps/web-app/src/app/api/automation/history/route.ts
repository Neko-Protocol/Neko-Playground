import { NextRequest, NextResponse } from "next/server";
import type { ActionLogEntry } from "@/features/automation/types/automation";

// In-memory log for demo; swap for a database in production
declare global {
  // eslint-disable-next-line no-var
  var __automationHistory: ActionLogEntry[] | undefined;
}
globalThis.__automationHistory ??= [];
const log = globalThis.__automationHistory;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const strategyId = searchParams.get("strategyId");
  const filtered = strategyId
    ? log.filter((e) => e.strategyId === strategyId)
    : log;
  return NextResponse.json([...filtered].reverse());
}
