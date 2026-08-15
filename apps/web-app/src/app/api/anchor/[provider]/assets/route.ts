import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleAnchorError } from "@/lib/anchors/handleAnchorError";
import { EtherfuseClient } from "@/lib/anchors/etherfuse";
import { ForbiddenError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/requireSession";
import { assertRateLimit } from "@/lib/rateLimit";
import { parseParam, parseQuery } from "@/lib/validation/parse";
import { AssetsQuerySchema, ProviderSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/anchor/[provider]/assets?wallet=<publicKey>
 * Returns rampable assets for the authenticated wallet only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const sessionResult = requireSession(request);
    if (sessionResult.error) return sessionResult.error;
    const session = sessionResult.session;

    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    await assertRateLimit(request, session);

    const { searchParams } = new URL(request.url);
    const queryResult = parseQuery(searchParams, AssetsQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { wallet } = queryResult.data;

    if (wallet !== session.publicKey) {
      throw new ForbiddenError("Wallet query must match the authenticated wallet");
    }

    const client = getAnchorClient(provider);
    if (!(client instanceof EtherfuseClient)) {
      return NextResponse.json(
        { error: "Provider does not support asset listing" },
        { status: 501 }
      );
    }

    const result = await client.getAssets("stellar", "mxn", wallet);
    return NextResponse.json(result);
  } catch (error) {
    return handleAnchorError(error);
  }
}
