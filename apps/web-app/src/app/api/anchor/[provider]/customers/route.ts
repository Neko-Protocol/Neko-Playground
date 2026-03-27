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
    const { email, country = "MX", publicKey } = body;

    const client = getAnchorClient(provider);
    const customer = await client.createCustomer({ email, country, publicKey });

    return NextResponse.json(customer, { status: 201 });
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
    const email = searchParams.get("email");
    const customerId = searchParams.get("customerId");
    const country = searchParams.get("country") || "MX";

    if (!email && !customerId) {
      return NextResponse.json(
        { error: "email or customerId query parameter is required" },
        { status: 400 }
      );
    }

    const client = getAnchorClient(provider);
    const customer = await client.getCustomer({
      email: email || undefined,
      customerId: customerId || undefined,
      country,
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
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
