import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleRouteError } from "@/lib/anchors/http";
import { parseJsonBody, parseParam, parseQuery } from "@/lib/validation/parse";
import {
  OnRampBodySchema,
  ProviderSchema,
  TransactionIdQuerySchema,
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

    const parsed = await parseJsonBody(request, OnRampBodySchema);
    if ("error" in parsed) return parsed.error;
    const {
      customerId,
      quoteId,
      stellarAddress,
      fromCurrency,
      toCurrency,
      amount,
      memo,
      bankAccountId,
    } = parsed.data;

    const client = getAnchorClient(provider);
    const transaction = await client.createOnRamp(
      {
        customerId,
        quoteId,
        stellarAddress,
        fromCurrency,
        toCurrency,
        amount,
        memo,
        bankAccountId,
      },
      request.signal
    );

    return NextResponse.json(transaction, { status: 201 });
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
    const queryResult = parseQuery(searchParams, TransactionIdQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { transactionId } = queryResult.data;

    const client = getAnchorClient(provider);
    const transaction = await client.getOnRampTransaction(
      transactionId,
      request.signal
    );

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    return handleRouteError(error);
  }
}
