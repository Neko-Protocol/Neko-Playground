import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleAnchorError } from "@/lib/anchors/handleAnchorError";
import { assertOwnsCustomer } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/requireSession";
import { assertRateLimit } from "@/lib/rateLimit";
import { parseJsonBody, parseParam } from "@/lib/validation/parse";
import { ProviderSchema, QuoteBodySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(
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

    await assertRateLimit(request, session, "anchor-quotes");

    const parsed = await parseJsonBody(request, QuoteBodySchema);
    if ("error" in parsed) return parsed.error;
    const {
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      customerId,
      resourceId,
    } = parsed.data;

    if (customerId) {
      await assertOwnsCustomer(session, provider, customerId);
    }

    const client = getAnchorClient(provider);
    const quote = await client.getQuote({
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      customerId,
      stellarAddress: session.publicKey,
      resourceId,
    });

    return NextResponse.json(quote);
  } catch (error) {
    return handleAnchorError(error);
  }
}
