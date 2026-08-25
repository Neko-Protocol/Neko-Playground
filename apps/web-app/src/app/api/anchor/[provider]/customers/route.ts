import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleRouteError } from "@/lib/anchors/http";
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
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const parsed = await parseJsonBody(request, CreateCustomerBodySchema);
    if ("error" in parsed) return parsed.error;
    const { email, country = "MX", publicKey } = parsed.data;

    const client = getAnchorClient(provider);
    const customer = await client.createCustomer(
      { email, country, publicKey },
      request.signal
    );

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const { searchParams } = new URL(request.url);
    const queryResult = parseQuery(searchParams, GetCustomerQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { email, customerId, country = "MX" } = queryResult.data;

    const client = getAnchorClient(provider);
    const customer = await client.getCustomer(
      {
        email: email || undefined,
        customerId: customerId || undefined,
        country,
      },
      request.signal
    );

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    return handleRouteError(error);
  }
}
