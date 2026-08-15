import { NextRequest, NextResponse } from "next/server";
import { TransactionBuilder, Transaction } from "@stellar/stellar-sdk";
import { handleAnchorError } from "@/lib/anchors/handleAnchorError";
import { ForbiddenError } from "@/lib/auth/errors";
import { assertOwnsTransaction } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/requireSession";
import { assertRateLimit } from "@/lib/rateLimit";
import { parseJsonBody, parseParam } from "@/lib/validation/parse";
import {
  OffRampSignBodySchema,
  ProviderSchema,
} from "@/lib/validation/schemas";
import { rpc, Horizon } from "@stellar/stellar-sdk";
import { clientEnv } from "@/lib/env.client";

export const dynamic = "force-dynamic";

/**
 * POST /api/anchor/[provider]/offramp/sign
 * Submit a signed XDR transaction for an Etherfuse off-ramp.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const sessionResult = requireSession(request);
    if (sessionResult.error) return sessionResult.error;
    const session = sessionResult.session;

    await assertRateLimit(request, session);

    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const parsed = await parseJsonBody(request, OffRampSignBodySchema);
    if ("error" in parsed) return parsed.error;
    const { signedXdr, transactionId } = parsed.data;

    if (transactionId) {
      await assertOwnsTransaction(session, provider, transactionId);
    }

    const { rpcUrl, networkPassphrase, horizonUrl } = clientEnv;
    const tx = TransactionBuilder.fromXDR(
      signedXdr,
      networkPassphrase
    ) as Transaction;

    if (tx.source !== session.publicKey) {
      throw new ForbiddenError(
        "Signed transaction source does not match authenticated wallet"
      );
    }

    const sorobanServer = new rpc.Server(rpcUrl);
    const horizonServer = new Horizon.Server(horizonUrl);

    try {
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
      const response = await horizonServer.submitTransaction(
        tx as Parameters<typeof horizonServer.submitTransaction>[0]
      );
      return NextResponse.json({
        success: true,
        hash: response.hash,
        transactionId,
      });
    }
  } catch (error) {
    return handleAnchorError(error);
  }
}
