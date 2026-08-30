import { NextRequest, NextResponse } from "next/server";
import { getAutomationStrategiesStore } from "@/lib/automation/strategiesStore";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const patch = await req.json();
  const store = getAutomationStrategiesStore();
  const updated = await store.update(params.id, patch);
  if (!updated)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = getAutomationStrategiesStore();
  const removed = await store.remove(params.id);
  if (!removed)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
