import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleAnchorError } from "@/lib/anchors/handleAnchorError";
import { assertOwnsCustomer } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/requireSession";
import { assertRateLimit } from "@/lib/rateLimit";
import { parseJsonBody, parseParam, parseQuery } from "@/lib/validation/parse";
import {
  CustomerIdQuerySchema,
  FiatAccountBodySchema,
  ProviderSchema,
} from "@/lib/validation/schemas";

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

    await assertRateLimit(request, session);

    const parsed = await parseJsonBody(request, FiatAccountBodySchema);
    if ("error" in parsed) return parsed.error;
    const { customerId, bankName, clabe, beneficiary } = parsed.data;

    await assertOwnsCustomer(session, provider, customerId);

    const client = getAnchorClient(provider);
    const result = await client.registerFiatAccount({
      customerId,
      publicKey: session.publicKey,
      account: {
        type: "spei",
        clabe,
        bankName: bankName || undefined,
        beneficiary,
      },
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleAnchorError(error);
  }
}

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
    const queryResult = parseQuery(searchParams, CustomerIdQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { customerId } = queryResult.data;

    await assertOwnsCustomer(session, provider, customerId);

    const client = getAnchorClient(provider);
    const accounts = await client.getFiatAccounts(customerId);
    return NextResponse.json(accounts);
  } catch (error) {
    return handleAnchorError(error);
  }
}
