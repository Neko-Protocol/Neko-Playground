import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, AnchorError } from "@/lib/anchors";
import { parseJsonBody, parseParam, parseQuery } from "@/lib/validation/parse";
import {
  OffRampBodySchema,
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

    const parsed = await parseJsonBody(request, OffRampBodySchema);
    if ("error" in parsed) return parsed.error;
    const {
      customerId,
      quoteId,
      stellarAddress,
      fromCurrency,
      toCurrency,
      amount,
      fiatAccountId: existingFiatAccountId,
      bankAccount,
      memo,
    } = parsed.data;

    const client = getAnchorClient(provider);
    let fiatAccountId: string;

    if (existingFiatAccountId) {
      fiatAccountId = existingFiatAccountId;
    } else {
      const { bankName, clabe, beneficiary } = bankAccount!;
      const fiatAccount = await client.registerFiatAccount({
        customerId,
        account: {
          type: "spei",
          clabe,
          bankName: bankName || undefined,
          beneficiary,
        },
      });
      fiatAccountId = fiatAccount.id;
    }

    const transaction = await client.createOffRamp({
      customerId,
      quoteId,
      stellarAddress,
      fromCurrency,
      toCurrency,
      amount,
      fiatAccountId,
      memo,
    });

    return NextResponse.json(transaction, { status: 201 });
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
    const queryResult = parseQuery(searchParams, TransactionIdQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const { transactionId } = queryResult.data;

    const client = getAnchorClient(provider);
    const transaction = await client.getOffRampTransaction(transactionId);

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(transaction);
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
