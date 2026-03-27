import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, isValidProvider, AnchorError } from "@/lib/anchors";
import { EtherfuseClient } from "@/lib/anchors/etherfuse";
import { AlfredPayClient } from "@/lib/anchors/alfredpay";

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
    const { provider } = await params;
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required" },
        { status: 400 }
      );
    }

    const client = getAnchorClient(provider);

    switch (action) {
      case "simulateFiatReceived": {
        if (!(client instanceof EtherfuseClient)) {
          return NextResponse.json(
            { error: "simulateFiatReceived is only supported for Etherfuse" },
            { status: 400 }
          );
        }
        const { orderId } = body;
        if (!orderId) {
          return NextResponse.json(
            { error: "orderId is required for simulateFiatReceived" },
            { status: 400 }
          );
        }
        const statusCode = await client.simulateFiatReceived(orderId);
        return NextResponse.json({ success: statusCode === 200, statusCode });
      }

      case "completeKyc": {
        if (!(client instanceof AlfredPayClient)) {
          return NextResponse.json(
            { error: "completeKyc is only supported for AlfredPay" },
            { status: 400 }
          );
        }
        const { submissionId } = body;
        if (!submissionId) {
          return NextResponse.json(
            { error: "submissionId is required for completeKyc" },
            { status: 400 }
          );
        }
        await client.completeKycSandbox(submissionId);
        return NextResponse.json({
          success: true,
          message: "KYC marked as completed",
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
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
