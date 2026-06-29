import { NextRequest, NextResponse } from "next/server";

// Re-use the same in-memory map (module singleton in dev)
// In prod, replace with a real database call
import type { Strategy } from "@/features/automation/types/automation";

declare global {
  // eslint-disable-next-line no-var
  var __automationStrategies: Map<string, Strategy> | undefined;
}
globalThis.__automationStrategies ??= new Map<string, Strategy>();
const store = globalThis.__automationStrategies;

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const existing = store.get(params.id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const patch = await req.json();
  const updated: Strategy = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: Date.now(),
  };
  store.set(updated.id, updated);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!store.has(params.id))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  store.delete(params.id);
  return new NextResponse(null, { status: 204 });
}
