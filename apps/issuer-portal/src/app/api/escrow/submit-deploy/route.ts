import { NextResponse } from "next/server";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE } from "@/lib/constants";
import { describeTransactionOperations } from "@/lib/stellar/operationSummary";
import { submitTwSignedTransaction } from "@/server/trustlessWork";

export const runtime = "nodejs";

interface Body {
  signedXdr: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body.signedXdr?.trim()) {
    return NextResponse.json(
      { error: "missing field: signedXdr" },
      { status: 400 }
    );
  }

  try {
    let opCount: number | undefined;
    let operations:
      | ReturnType<typeof describeTransactionOperations>
      | undefined;
    try {
      const tx = TransactionBuilder.fromXDR(
        body.signedXdr.trim(),
        NETWORK_PASSPHRASE
      );
      opCount = tx.operations.length;
      operations = describeTransactionOperations(tx);
    } catch {
      opCount = undefined;
    }
    console.log("[issuer-portal][api/escrow/submit-deploy] request", {
      signedXdrLength: body.signedXdr.length,
      operationCount: opCount,
      operations,
      xdrPrefix: body.signedXdr.slice(0, 120),
    });

    const out = await submitTwSignedTransaction(body.signedXdr.trim());
    console.log("[issuer-portal][api/escrow/submit-deploy] success", {
      hash: out.hash,
      contractAddress: out.contractAddress ?? null,
    });
    return NextResponse.json({
      hash: out.hash,
      contractAddress: out.contractAddress ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[issuer-portal] POST /api/escrow/submit-deploy error", {
      message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    try {
      const tx = TransactionBuilder.fromXDR(
        body.signedXdr.trim(),
        NETWORK_PASSPHRASE
      );
      console.error("[issuer-portal] submit-deploy signed XDR", {
        operationCount: tx.operations.length,
        operations: describeTransactionOperations(tx),
      });
    } catch (parseErr) {
      console.error(
        "[issuer-portal] submit-deploy could not parse signed XDR",
        parseErr instanceof Error ? parseErr.message : parseErr
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
