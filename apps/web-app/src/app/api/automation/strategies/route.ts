import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Strategy } from "@/features/automation/types/automation";
import { PRESET_RULES } from "@/features/automation/const/automation";

// In-memory store for demo; swap for a real DB in production
declare global {
  // eslint-disable-next-line no-var
  var __automationStrategies: Map<string, Strategy> | undefined;
}
globalThis.__automationStrategies ??= new Map<string, Strategy>();
const store = globalThis.__automationStrategies;

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json([...store.values()]);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const now = Date.now();
  const strategy: Strategy = {
    id: nanoid(),
    name: body.name ?? "Unnamed",
    preset: body.preset ?? "balanced",
    rule: body.rule ?? PRESET_RULES.balanced,
    enabled: body.enabled ?? false,
    createdAt: now,
    updatedAt: now,
  };
  store.set(strategy.id, strategy);
  return NextResponse.json(strategy, { status: 201 });
}
