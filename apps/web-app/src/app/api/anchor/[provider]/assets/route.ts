import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, AnchorError } from "@/lib/anchors";
import { EtherfuseClient } from "@/lib/anchors/etherfuse";
import { parseParam, parseQuery } from "@/lib/validation/parse";
import { AssetsQuerySchema, ProviderSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * GET /api/anchor/[provider]/assets?wallet=<publicKey>
 * Returns the rampable assets for a given wallet. Used to check trustlines.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const { searchParams } = new URL(request.url);
    const queryResult = parseQuery(searchParams, AssetsQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { wallet } = queryResult.data;

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
    if (error instanceof AnchorError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
