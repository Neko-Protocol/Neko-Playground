import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, AnchorError } from "@/lib/anchors";
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
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const { searchParams } = new URL(request.url);
    const queryResult = parseQuery(searchParams, CustomerIdQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { customerId } = queryResult.data;

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
