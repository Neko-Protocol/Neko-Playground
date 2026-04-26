import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { StrKey } from "@stellar/stellar-sdk";
import { createEscrow } from "@/server/trustlessWork";

/** Unique TW engagement / Neko listing id (never reuse `tokenContract` — avoids collisions). */
function newListingEngagementId(): string {
  return `NEKO-${randomUUID().replace(/-/g, "")}`;
}

export const runtime = "nodejs";

interface Body {
  issuerAddress: string;
  /** Optional `G…` for `trustline.address` (defaults to `issuerAddress`). */
  trustlineAddress?: string;
  tokenContract: string;
  tokenDecimals: number;
  totalAmount: string;
  symbol: string;
  /** Optional classic asset issuer (G…) for TW trustline when `tokenContract` is Soroban (C…). */
  trustlineClassicIssuer?: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  for (const k of [
    "issuerAddress",
    "tokenContract",
    "totalAmount",
    "symbol",
  ] as const) {
    if (!body[k]) {
      return NextResponse.json(
        { error: `missing field: ${k}` },
        { status: 400 }
      );
    }
  }
  if (typeof body.tokenDecimals !== "number") {
    return NextResponse.json(
      { error: "tokenDecimals must be a number" },
      { status: 400 }
    );
  }

  if (!StrKey.isValidEd25519PublicKey(body.issuerAddress.trim())) {
    return NextResponse.json(
      { error: "issuerAddress must be a valid Stellar G-address" },
      { status: 400 }
    );
  }
  if (body.trustlineAddress !== undefined && body.trustlineAddress !== "") {
    if (!StrKey.isValidEd25519PublicKey(body.trustlineAddress.trim())) {
      return NextResponse.json(
        { error: "trustlineAddress must be a valid Stellar G-address" },
        { status: 400 }
      );
    }
  }
  if (
    body.trustlineClassicIssuer !== undefined &&
    body.trustlineClassicIssuer !== "" &&
    !StrKey.isValidEd25519PublicKey(body.trustlineClassicIssuer.trim())
  ) {
    return NextResponse.json(
      { error: "trustlineClassicIssuer must be a valid Stellar G-address" },
      { status: 400 }
    );
  }

  try {
    const listingId = newListingEngagementId();
    console.log("[issuer-portal][api/escrow/create] request", {
      listingId,
      issuerAddress: body.issuerAddress?.slice(0, 8) + "…",
      tokenContract: body.tokenContract,
      tokenDecimals: body.tokenDecimals,
      totalAmount: body.totalAmount,
      symbol: body.symbol,
      trustlineAddress: body.trustlineAddress ?? null,
      trustlineClassicIssuer: body.trustlineClassicIssuer
        ? body.trustlineClassicIssuer.slice(0, 8) + "…"
        : null,
    });
    const result = await createEscrow({
      issuer: body.issuerAddress,
      trustlineAddress: body.trustlineAddress,
      tokenContract: body.tokenContract,
      tokenDecimals: body.tokenDecimals,
      totalAmount: body.totalAmount,
      symbol: body.symbol,
      trustlineClassicIssuer: body.trustlineClassicIssuer,
      listingId,
      title: `Neko ${body.symbol} (${body.tokenContract.slice(0, 8)}…)`,
      description: `Trustless Work escrow for Neko listing ${listingId} — token ${body.tokenContract.slice(0, 8)}…`,
    });
    console.log("[issuer-portal][api/escrow/create] result", {
      listingId: result.escrowId,
      mock: result.mock,
      fundingMode: result.fundingMode,
      escrowId: result.escrowId,
      escrowAddress: result.escrowAddress || null,
      deployUnsignedXdrLen: result.deployUnsignedXdr?.length ?? 0,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[issuer-portal][api/escrow/create] error", {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
