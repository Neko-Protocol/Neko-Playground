import { NextRequest, NextResponse } from "next/server";
import { getAutomationStrategiesStore } from "@/lib/automation/strategiesStore";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = getAutomationStrategiesStore();
  const patch = await req.json();
  const updated = await store.updateStrategy(params.id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = getAutomationStrategiesStore();
  const existing = await store.getStrategy(params.id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await store.deleteStrategy(params.id);
  return new NextResponse(null, { status: 204 });
}
