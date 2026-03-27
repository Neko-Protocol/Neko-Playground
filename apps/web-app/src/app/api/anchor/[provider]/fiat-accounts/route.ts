import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, isValidProvider, AnchorError } from "@/lib/anchors";

export const dynamic = "force-dynamic";

export async function POST(
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

    const body = await request.json();
    const { customerId, publicKey, bankName, clabe, beneficiary } = body;

    if (!customerId || !clabe || !beneficiary) {
      return NextResponse.json(
        { error: "customerId, clabe, and beneficiary are required" },
        { status: 400 }
      );
    }

    const client = getAnchorClient(provider);
    const result = await client.registerFiatAccount({
      customerId,
      publicKey: publicKey || undefined,
      account: {
        type: "spei",
        clabe,
        bankName: bankName || undefined,
        beneficiary,
      },
    });

    return NextResponse.json(result, { status: 201 });
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
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId query parameter is required" },
        { status: 400 }
      );
    }

    const client = getAnchorClient(provider);
    const accounts = await client.getFiatAccounts(customerId);
    return NextResponse.json(accounts);
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
