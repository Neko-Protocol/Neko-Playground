import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import type { Strategy } from "@/features/automation/types/automation";
import { PRESET_RULES } from "@/features/automation/const/automation";
import {
  listStrategies,
  saveStrategy,
} from "@/lib/automation/store";
import { requireSession } from "@/lib/auth/requireSession";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = requireSession(request);
  if (sessionResult.error) return sessionResult.error;

  const strategies = await listStrategies(sessionResult.session.publicKey);
  return NextResponse.json(strategies);
}

export async function POST(request: NextRequest) {
  const sessionResult = requireSession(request);
  if (sessionResult.error) return sessionResult.error;

  const body = await request.json();
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

  await saveStrategy(sessionResult.session.publicKey, strategy);
  return NextResponse.json(strategy, { status: 201 });
}
