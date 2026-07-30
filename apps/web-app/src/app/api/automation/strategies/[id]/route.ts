import { NextRequest, NextResponse } from "next/server";
import type { Strategy } from "@/features/automation/types/automation";
import {
  deleteStrategy,
  getStrategy,
  saveStrategy,
} from "@/lib/automation/store";
import { requireSession } from "@/lib/auth/requireSession";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionResult = requireSession(request);
  if (sessionResult.error) return sessionResult.error;

  const { id } = await params;
  const existing = await getStrategy(sessionResult.session.publicKey, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const patch = await request.json();
  const updated: Strategy = {
    ...existing,
    ...patch,
    id: existing.id,
    updatedAt: Date.now(),
  };
  await saveStrategy(sessionResult.session.publicKey, updated);
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionResult = requireSession(request);
  if (sessionResult.error) return sessionResult.error;

  const { id } = await params;
  const deleted = await deleteStrategy(sessionResult.session.publicKey, id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return new NextResponse(null, { status: 204 });
}
