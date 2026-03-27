import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, isValidProvider, AnchorError } from "@/lib/anchors";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const body = await request.json();
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
    } = body;

    if (
      !customerId ||
      !quoteId ||
      !stellarAddress ||
      !fromCurrency ||
      !toCurrency ||
      !amount
    ) {
      return NextResponse.json(
        {
          error:
            "customerId, quoteId, stellarAddress, fromCurrency, toCurrency, and amount are required",
        },
        { status: 400 }
      );
    }

    if (!existingFiatAccountId && !bankAccount) {
      return NextResponse.json(
        { error: "Either fiatAccountId or bankAccount is required" },
        { status: 400 }
      );
    }

    const client = getAnchorClient(provider);
    let fiatAccountId: string;

    if (existingFiatAccountId) {
      fiatAccountId = existingFiatAccountId;
    } else {
      const { bankName, clabe, beneficiary } = bankAccount;
      if (!clabe || !beneficiary) {
        return NextResponse.json(
          { error: "bankAccount must include clabe and beneficiary" },
          { status: 400 }
        );
      }
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
    const { provider } = await params;
    if (!isValidProvider(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");

    if (!transactionId) {
      return NextResponse.json(
        { error: "transactionId query parameter is required" },
        { status: 400 }
      );
    }

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
