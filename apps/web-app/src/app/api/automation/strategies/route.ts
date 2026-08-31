import { NextRequest, NextResponse } from "next/server";
import { PRESET_RULES } from "@/features/automation/const/automation";
import { getStrategiesStore } from "@/lib/automation/strategiesStore";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getStrategiesStore().list());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const strategy = await getStrategiesStore().create({
    name: body.name ?? "Unnamed",
    preset: body.preset ?? "balanced",
    rule: body.rule ?? PRESET_RULES.balanced,
    enabled: body.enabled ?? false,
  });
  return NextResponse.json(strategy, { status: 201 });
}
