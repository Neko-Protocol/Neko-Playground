import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, AnchorError } from "@/lib/anchors";
import { parseJsonBody, parseParam } from "@/lib/validation/parse";
import { ProviderSchema, QuoteBodySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const parsed = await parseJsonBody(request, QuoteBodySchema);
    if ("error" in parsed) return parsed.error;
    const {
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      customerId,
      stellarAddress,
      resourceId,
    } = parsed.data;

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
