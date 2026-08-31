import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation/parse";
import { raiseEvent } from "@/lib/event-platform/outbox";
import {
  requireWalletSession,
  UnauthorizedError,
} from "@/lib/event-platform/auth/session";

export const dynamic = "force-dynamic";

// Mirrors ActivityEvent minus `read` — the store already generated `id`
// before calling this route, and reuses it as the dedupe key so a retried
// fire-and-forget POST can never double-enqueue the same occurrence.
const BodySchema = z.object({
  id: z.string().uuid(),
  source: z.enum(["swap", "automation", "vault", "borrowing"]),
  type: z.string().min(1),
  summary: z.string(),
  link: z.string(),
  timestamp: z.number(),
  metadata: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const walletAddress = await requireWalletSession(request);
    const parsed = await parseJsonBody(request, BodySchema);
    if ("error" in parsed) return parsed.error;

    const { id, source, type, summary, link, timestamp, metadata } =
      parsed.data;

    const result = await raiseEvent({
      source,
      walletAddress,
      dedupeKey: id,
      eventType: type,
      severity: "info",
      payload: { summary, link, timestamp, ...metadata },
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
