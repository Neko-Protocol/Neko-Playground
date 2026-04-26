import { NextResponse } from "next/server";
import {
  extractCountry,
  fetchDiditDecision,
  verifyDiditWebhook,
} from "@/server/didit";
import { kycStore } from "@/server/kycStore";

function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
}

/**
 * DIDIT redirects the user's browser here (GET) after verification, with query
 * params like `verificationSessionId` and `status=Approved`. That is
 * separate from the server-to-server POST webhook with HMAC body.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId =
    url.searchParams.get("verificationSessionId") ??
    url.searchParams.get("session_id");
  const queryStatus = (url.searchParams.get("status") ?? "").toLowerCase();
  const base = appBaseUrl().replace(/\/$/, "");

  if (!sessionId) {
    return NextResponse.redirect(
      `${base}/issuer/list?kyc=error&reason=missing_session`
    );
  }

  const session = kycStore.get(sessionId);
  const returnPath =
    session?.returnPath &&
    session.returnPath.startsWith("/") &&
    !session.returnPath.startsWith("//")
      ? session.returnPath.split("?")[0]
      : "/issuer/list";

  const isMock = process.env.NEXT_PUBLIC_DIDIT_MOCK === "true";

  if (isMock) {
    if (queryStatus === "approved" || queryStatus === "verified") {
      kycStore.approve(sessionId, "US");
    } else if (
      ["declined", "rejected", "abandoned", "expired"].includes(queryStatus)
    ) {
      kycStore.reject(sessionId);
    }
    return NextResponse.redirect(`${base}${returnPath}?kyc=pending`);
  }

  let approvedNow = false;
  try {
    const decision = await fetchDiditDecision(sessionId);
    const st = (decision.status ?? "").toLowerCase();
    if (st === "approved" || st === "verified") {
      kycStore.approve(sessionId, extractCountry(decision) ?? "US");
      approvedNow = true;
    } else if (["declined", "rejected", "abandoned", "expired"].includes(st)) {
      kycStore.reject(sessionId);
    }
  } catch (e) {
    console.error("[kyc/webhook GET] decision fetch failed", e);
    // Still redirect off the broken API URL; POST webhook may complete later.
  }

  const suffix = approvedNow ? "" : "?kyc=pending";
  return NextResponse.redirect(`${base}${returnPath}${suffix}`);
}

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
