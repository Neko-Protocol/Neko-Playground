import { NextResponse } from "next/server";
import {
  extractCountry,
  fetchDiditDecision,
  verifyDiditWebhook,
} from "@/server/didit";
import { kycStore } from "@/server/kycStore";

interface DiditWebhookBody {
  session_id?: string;
  status?: string;
  vendor_data?: string;
  decision?: Record<string, unknown>;
}

function getSignatureHeader(req: Request): string | null {
  return (
    req.headers.get("x-signature") ??
    req.headers.get("x-didit-signature") ??
    req.headers.get("didit-signature")
  );
}

export async function POST(req: Request) {
  const raw = await req.text();
  const signature = getSignatureHeader(req);

  if (!verifyDiditWebhook(raw, signature)) {
    console.warn("[kyc/webhook] invalid signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: DiditWebhookBody;
  try {
    body = JSON.parse(raw) as DiditWebhookBody;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const sessionId = body.session_id;
  if (!sessionId) {
    return NextResponse.json({ error: "missing session_id" }, { status: 400 });
  }

  const status = (body.status ?? "").toLowerCase();
  const isApproved = status === "approved" || status === "verified";
  const isDeclined =
    status === "declined" ||
    status === "rejected" ||
    status === "abandoned" ||
    status === "expired";

  if (isApproved) {
    let country = body.vendor_data ? "US" : "US";
    const isMock = process.env.NEXT_PUBLIC_DIDIT_MOCK === "true";
    if (!isMock) {
      try {
        const decision = await fetchDiditDecision(sessionId);
        country = extractCountry(decision) ?? country;
      } catch (e) {
        console.error("[kyc/webhook] failed to fetch decision", e);
      }
    } else {
      const bodyCountry = (body as { country?: string }).country;
      if (bodyCountry) country = bodyCountry;
    }
    kycStore.approve(sessionId, country);
  } else if (isDeclined) {
    kycStore.reject(sessionId);
  } else {
    console.info("[kyc/webhook] ignored status", status);
  }

  return NextResponse.json({ ok: true });
}
