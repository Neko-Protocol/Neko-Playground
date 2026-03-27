import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, isValidProvider, AnchorError } from "@/lib/anchors";
import { EtherfuseClient } from "@/lib/anchors/etherfuse";

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
    const { provider } = await params;
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json(
        { error: "wallet query parameter is required" },
        { status: 400 }
      );
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
