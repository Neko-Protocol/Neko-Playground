import { NextRequest, NextResponse } from "next/server";
import { getAutomationStrategiesStore } from "@/lib/automation/strategiesStore";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = getAutomationStrategiesStore();
  const strategies = await store.list();
  return NextResponse.json(strategies);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const store = getAutomationStrategiesStore();
  const strategy = await store.create({
    name: body.name,
    preset: body.preset,
    rule: body.rule,
    enabled: body.enabled,
  });
  return NextResponse.json(strategy, { status: 201 });
}
