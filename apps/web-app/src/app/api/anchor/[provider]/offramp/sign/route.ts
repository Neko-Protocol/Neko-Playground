import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, isValidProvider, AnchorError } from "@/lib/anchors";
import { EtherfuseClient } from "@/lib/anchors/etherfuse";
import { rpc, Horizon, TransactionBuilder } from "@stellar/stellar-sdk";

export const dynamic = "force-dynamic";

/**
 * POST /api/anchor/[provider]/offramp/sign
 * Submit a signed XDR transaction for an Etherfuse off-ramp.
 * After signing the burn XDR from getOffRampTransaction, post it here.
 */
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
    const { signedXdr, transactionId } = body;

    if (!signedXdr) {
      return NextResponse.json(
        { error: "signedXdr is required" },
        { status: 400 }
      );
    }

    const rpcUrl =
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
      "https://soroban-testnet.stellar.org";
    const networkPassphrase =
      process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
      "Test SDF Network ; September 2015";
    const horizonUrl =
      process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ||
      "https://horizon-testnet.stellar.org";

    // Submit the signed XDR directly to Stellar network
    const sorobanServer = new rpc.Server(rpcUrl);
    const horizonServer = new Horizon.Server(horizonUrl);

    try {
      // Try Soroban RPC first
      const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
      const response = await sorobanServer.sendTransaction(
        tx as Parameters<typeof sorobanServer.sendTransaction>[0]
      );
      return NextResponse.json({
        success: true,
        hash: response.hash,
        status: response.status,
        transactionId,
      });
    } catch {
      // Fall back to Horizon for classic transactions
      try {
        const response = await horizonServer.submitTransaction(
          TransactionBuilder.fromXDR(
            signedXdr,
            networkPassphrase
          ) as Parameters<typeof horizonServer.submitTransaction>[0]
        );
        return NextResponse.json({
          success: true,
          hash: response.hash,
          transactionId,
        });
      } catch (horizonError) {
        throw horizonError;
      }
    }
  } catch (error) {
    if (error instanceof AnchorError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      {
        error: "Failed to submit signed transaction",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
