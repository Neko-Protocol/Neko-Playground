import crypto from "node:crypto";

/**
 * DIDIT KYC client. Session-based flow: we create a session via API, redirect
 * the user to DIDIT, receive a signed webhook when the decision is ready, and
 * read the full decision via GET /v2/session/{id}/decision.
 */

const DIDIT_BASE_URL = "https://verification.didit.me";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateSessionInput {
  workflowId: string;
  referenceId: string;
  callbackUrl: string;
}

export interface CreateSessionResult {
  sessionId: string;
  verificationUrl: string;
}

export async function createDiditSession(
  input: CreateSessionInput
): Promise<CreateSessionResult> {
  if (process.env.NEXT_PUBLIC_DIDIT_MOCK === "true") {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
    const sessionId = `mock_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    const verificationUrl = `${appUrl}/mock-kyc?sessionId=${encodeURIComponent(
      sessionId
    )}&reference=${encodeURIComponent(
      input.referenceId
    )}&redirectTo=/issuer/list?kyc=pending`;
    return { sessionId, verificationUrl };
  }

  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) throw new Error("DIDIT_API_KEY not configured");

  const res = await fetch(`${DIDIT_BASE_URL}/v2/session/`, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      workflow_id: input.workflowId,
      vendor_data: input.referenceId,
      callback: input.callbackUrl,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DIDIT session creation failed: ${res.status} ${txt}`);
  }

  const body = (await res.json()) as {
    session_id: string;
    session_token?: string;
    url: string;
  };
  return { sessionId: body.session_id, verificationUrl: body.url };
}

export function workflowIdForLevel(
  level: "basic" | "accredited" | "institutional"
): string {
  if (process.env.NEXT_PUBLIC_DIDIT_MOCK === "true") {
    return `mock_workflow_${level}`;
  }
  const envKey =
    level === "institutional"
      ? "DIDIT_WORKFLOW_INSTITUTIONAL"
      : level === "accredited"
        ? "DIDIT_WORKFLOW_ACCREDITED"
        : "DIDIT_WORKFLOW_BASIC";
  const raw = process.env[envKey];
  if (!raw) throw new Error(`${envKey} not configured`);
  if (raw.startsWith("http")) {
    throw new Error(
      `${envKey} looks like a shared-link URL ("${raw}"). Paste the workflow_id UUID from the DIDIT portal instead.`
    );
  }
  if (!UUID_RE.test(raw)) {
    throw new Error(
      `${envKey}="${raw}" is not a valid UUID. Use the workflow_id from the DIDIT portal.`
    );
  }
  return raw;
}

/**
 * Verify DIDIT webhook signature. DIDIT signs the raw request body with
 * HMAC-SHA256 using the webhook secret and sends the hex digest in
 * x-signature (falls back to x-didit-signature for older configurations).
 */
export function verifyDiditWebhook(
  rawBody: string,
  signature: string | null
): boolean {
  if (process.env.NEXT_PUBLIC_DIDIT_MOCK === "true") return true;
  if (!signature) return false;
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export interface DiditDecision {
  session_id: string;
  status: string;
  vendor_data?: string;
  kyc?: {
    document_type?: string;
    issuing_state?: string;
    issuing_state_name?: string;
    nationality?: string;
    country?: string;
  } & Record<string, unknown>;
  decision?: Record<string, unknown>;
  features?: Record<string, unknown>;
  [key: string]: unknown;
}

export async function fetchDiditDecision(
  sessionId: string
): Promise<DiditDecision> {
  const apiKey = process.env.DIDIT_API_KEY;
  if (!apiKey) throw new Error("DIDIT_API_KEY not configured");

  const res = await fetch(
    `${DIDIT_BASE_URL}/v2/session/${encodeURIComponent(sessionId)}/decision/`,
    {
      method: "GET",
      headers: { "x-api-key": apiKey },
    }
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`DIDIT decision fetch failed: ${res.status} ${txt}`);
  }
  return (await res.json()) as DiditDecision;
}

/** Extract a 2-letter country code from a DIDIT decision payload. */
export function extractCountry(d: DiditDecision): string | undefined {
  const kyc = d.kyc ?? {};
  const candidates = [
    kyc.issuing_state,
    kyc.nationality,
    kyc.country,
    (kyc as Record<string, unknown>)["issuing_country"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length >= 2) {
      return c.slice(0, 2).toUpperCase();
    }
  }
  return undefined;
}
