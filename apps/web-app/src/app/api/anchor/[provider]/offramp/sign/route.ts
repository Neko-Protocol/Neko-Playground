import { NextRequest, NextResponse } from "next/server";
import {
  disconnectedResponse,
  handleRouteError,
  raceWithSignal,
} from "@/lib/anchors/http";
import { parseJsonBody, parseParam } from "@/lib/validation/parse";
import {
  OffRampSignBodySchema,
  ProviderSchema,
} from "@/lib/validation/schemas";
import { Horizon, TransactionBuilder } from "@stellar/stellar-sdk";
import { clientEnv } from "@/lib/env.client";
import { getSorobanServer } from "@/lib/helpers/stellar/sorobanServer";

export const dynamic = "force-dynamic";

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

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
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;

    const parsed = await parseJsonBody(request, OffRampSignBodySchema);
    if ("error" in parsed) return parsed.error;
    const { signedXdr, transactionId } = parsed.data;

    const { rpcUrl, networkPassphrase, horizonUrl } = clientEnv;

    const sorobanServer = getSorobanServer(rpcUrl);
    const horizonServer = new Horizon.Server(horizonUrl);

    try {
      const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
      const response = await raceWithSignal(
        sorobanServer.sendTransaction(
          tx as Parameters<typeof sorobanServer.sendTransaction>[0]
        ),
        request.signal
      );
      return NextResponse.json({
        success: true,
        hash: response.hash,
        status: response.status,
        transactionId,
      });
    } catch {
      try {
        const response = await raceWithSignal(
          horizonServer.submitTransaction(
            TransactionBuilder.fromXDR(
              signedXdr,
              networkPassphrase
            ) as Parameters<typeof horizonServer.submitTransaction>[0]
          ),
          request.signal
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
    if (isAbortError(error)) {
      return disconnectedResponse();
    }

    const response = handleRouteError(error);
    if (response.status !== 500) {
      return response;
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
