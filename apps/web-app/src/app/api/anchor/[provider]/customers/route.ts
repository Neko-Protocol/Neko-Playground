import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleAnchorError } from "@/lib/anchors/handleAnchorError";
import { bindCustomer, assertOwnsCustomer } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/requireSession";
import { assertRateLimit } from "@/lib/rateLimit";
import { parseJsonBody, parseParam, parseQuery } from "@/lib/validation/parse";
import {
  CreateCustomerBodySchema,
  GetCustomerQuerySchema,
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

    await assertRateLimit(request, session, "anchor-customers");

    const parsed = await parseJsonBody(request, CreateCustomerBodySchema);
    if ("error" in parsed) return parsed.error;
    const { email, country = "MX" } = parsed.data;

    const client = getAnchorClient(provider);
    const customer = await client.createCustomer({
      email,
      country,
      publicKey: session.publicKey,
    });

    await bindCustomer(provider, customer.id, session.publicKey);

    return NextResponse.json(customer, { status: 201 });
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
    const queryResult = parseQuery(searchParams, GetCustomerQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { customerId } = queryResult.data;

    await assertOwnsCustomer(session, provider, customerId);

    const client = getAnchorClient(provider);
    const customer = await client.getCustomer({ customerId });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    return handleAnchorError(error);
  }
}
