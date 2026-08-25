import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleRouteError } from "@/lib/anchors/http";
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
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const parsed = await parseJsonBody(request, FiatAccountBodySchema);
    if ("error" in parsed) return parsed.error;
    const { customerId, publicKey, bankName, clabe, beneficiary } = parsed.data;

    const client = getAnchorClient(provider);
    const result = await client.registerFiatAccount(
      {
        customerId,
        publicKey: publicKey || undefined,
        account: {
          type: "spei",
          clabe,
          bankName: bankName || undefined,
          beneficiary,
        },
      },
      request.signal
    );

    return NextResponse.json(result, { status: 201 });
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
    const queryResult = parseQuery(searchParams, CustomerIdQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { customerId } = queryResult.data;

    const client = getAnchorClient(provider);
    const accounts = await client.getFiatAccounts(customerId, request.signal);
    return NextResponse.json(accounts);
  } catch (error) {
    return handleRouteError(error);
  }
}
