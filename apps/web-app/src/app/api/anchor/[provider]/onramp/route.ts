import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleAnchorError } from "@/lib/anchors/handleAnchorError";
import {
  assertOwnsCustomer,
  assertOwnsTransaction,
  bindTransaction,
} from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/requireSession";
import { assertRateLimit } from "@/lib/rateLimit";
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
    const sessionResult = requireSession(request);
    if (sessionResult.error) return sessionResult.error;
    const session = sessionResult.session;

    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    await assertRateLimit(request, session);

    const parsed = await parseJsonBody(request, OnRampBodySchema);
    if ("error" in parsed) return parsed.error;
    const {
      customerId,
      quoteId,
      fromCurrency,
      toCurrency,
      amount,
      memo,
      bankAccountId,
    } = parsed.data;

    await assertOwnsCustomer(session, provider, customerId);

    const client = getAnchorClient(provider);
    const transaction = await client.createOnRamp({
      customerId,
      quoteId,
      stellarAddress: session.publicKey,
      fromCurrency,
      toCurrency,
      amount,
      memo,
      bankAccountId,
    });

    await bindTransaction(provider, transaction.id, {
      customerId,
      publicKey: session.publicKey,
    });

    return NextResponse.json(transaction, { status: 201 });
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
    const queryResult = parseQuery(searchParams, TransactionIdQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { transactionId } = queryResult.data;

    await assertOwnsTransaction(session, provider, transactionId);

    const client = getAnchorClient(provider);
    const transaction = await client.getOnRampTransaction(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
  } catch (error) {
    return handleAnchorError(error);
  }
}
