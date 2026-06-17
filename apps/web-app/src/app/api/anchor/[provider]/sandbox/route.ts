import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, AnchorError } from "@/lib/anchors";
import { EtherfuseClient } from "@/lib/anchors/etherfuse";
import { AlfredPayClient } from "@/lib/anchors/alfredpay";
import { parseJsonBody, parseParam } from "@/lib/validation/parse";
import { ProviderSchema, SandboxBodySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/anchor/[provider]/sandbox
 * Dev/sandbox-only operations: simulate fiat received, complete KYC.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  if (process.env.NEXT_PUBLIC_STELLAR_NETWORK === "PUBLIC") {
    return NextResponse.json(
      { error: "Sandbox endpoints are not available on mainnet" },
      { status: 403 }
    );
  }

  try {
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const parsed = await parseJsonBody(request, SandboxBodySchema);
    if ("error" in parsed) return parsed.error;
    const body = parsed.data;

    const client = getAnchorClient(provider);

    switch (body.action) {
      case "simulateFiatReceived": {
        if (!(client instanceof EtherfuseClient)) {
          return NextResponse.json(
            { error: "simulateFiatReceived is only supported for Etherfuse" },
            { status: 400 }
          );
        }
        const statusCode = await client.simulateFiatReceived(body.orderId);
        return NextResponse.json({ success: statusCode === 200, statusCode });
      }

      case "completeKyc": {
        if (!(client instanceof AlfredPayClient)) {
          return NextResponse.json(
            { error: "completeKyc is only supported for AlfredPay" },
            { status: 400 }
          );
        }
        await client.completeKycSandbox(body.submissionId);
        return NextResponse.json({
          success: true,
          message: "KYC marked as completed",
        });
      }
    }
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
