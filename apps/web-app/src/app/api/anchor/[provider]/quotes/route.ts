import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleRouteError } from "@/lib/anchors/http";
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
    const quote = await client.getQuote(
      {
        fromCurrency,
        toCurrency,
        fromAmount,
        toAmount,
        customerId,
        stellarAddress,
        resourceId,
      },
      request.signal
    );

    return NextResponse.json(quote);
  } catch (error) {
    return handleRouteError(error);
  }
}
