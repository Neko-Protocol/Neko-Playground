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
    const {
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      customerId,
      stellarAddress,
      resourceId,
    } = body;

    if (!fromCurrency || !toCurrency) {
      return NextResponse.json(
        { error: "fromCurrency and toCurrency are required" },
        { status: 400 }
      );
    }
    if (!fromAmount && !toAmount) {
      return NextResponse.json(
        { error: "Either fromAmount or toAmount is required" },
        { status: 400 }
      );
    }

    const client = getAnchorClient(provider);
    const quote = await client.getQuote({
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      customerId,
      stellarAddress,
      resourceId,
    });

    return NextResponse.json(quote);
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
