import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Strategy } from "@/features/automation/types/automation";
import { PRESET_RULES } from "@/features/automation/const/automation";
import { getAutomationStrategiesStore } from "@/lib/automation/strategiesStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getAutomationStrategiesStore();
  const list = await store.listStrategies();
  return NextResponse.json(list);
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
  const store = getAutomationStrategiesStore();
  const created = await store.createStrategy(strategy);
  return NextResponse.json(created, { status: 201 });
}
