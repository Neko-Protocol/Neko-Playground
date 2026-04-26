import { NextResponse } from "next/server";
import { rpc, scValToNative, xdr } from "@stellar/stellar-sdk";
import { RPC_URL } from "@/lib/constants";
import { releaseMilestone } from "@/server/trustlessWork";

export const runtime = "nodejs";

interface Body {
  buyHash: string;
  escrowId: string;
  escrowAddress: string;
  tokenContract: string;
  tokenDecimals: number;
  buyerAddress: string;
  amountBaseUnits: string;
}

const sorobanServer = new rpc.Server(RPC_URL, { allowHttp: true });

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const required = [
    "buyHash",
    "escrowId",
    "escrowAddress",
    "tokenContract",
    "buyerAddress",
    "amountBaseUnits",
  ] as const;
  for (const k of required) {
    if (!body[k]) {
      return NextResponse.json(
        { error: `missing field: ${k}` },
        { status: 400 }
      );
    }
  }
  if (typeof body.tokenDecimals !== "number") {
    return NextResponse.json(
      { error: "tokenDecimals must be a number" },
      { status: 400 }
    );
  }

  // Verify the on-chain buy actually happened and matches the requested
  // release. We poll briefly because the buy tx may have just been submitted.
  let verified = false;
  let lastError = "";
  for (let i = 0; i < 10; i++) {
    try {
      const tx = await sorobanServer.getTransaction(body.buyHash);
      if (tx.status === "SUCCESS") {
        verified = verifyBuyEvent(tx, body);
        if (verified) break;
        lastError = "buy_executed event does not match request";
        break;
      }
      if (tx.status === "FAILED") {
        return NextResponse.json(
          { error: "buy transaction failed on-chain" },
          { status: 400 }
        );
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "unknown rpc error";
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!verified) {
    return NextResponse.json(
      { error: lastError || "could not verify buy transaction" },
      { status: 400 }
    );
  }

  try {
    const result = await releaseMilestone({
      escrowId: body.escrowId,
      escrowAddress: body.escrowAddress,
      tokenContract: body.tokenContract,
      tokenDecimals: body.tokenDecimals,
      beneficiary: body.buyerAddress,
      amountBaseUnits: body.amountBaseUnits,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface VerificationInput {
  tokenContract: string;
  buyerAddress: string;
  amountBaseUnits: string;
}

/**
 * Walk the contract events emitted by the buy tx and confirm at least one
 * `buy_executed` event whose payload matches (token, buyer, amount).
 */
function verifyBuyEvent(
  tx: rpc.Api.GetTransactionResponse,
  input: VerificationInput
): boolean {
  if (tx.status !== "SUCCESS") return false;
  const meta = tx.resultMetaXdr;
  if (!meta) return false;

  const events = collectContractEvents(meta);
  for (const ev of events) {
    try {
      const topics = ev.topics().map((t) => scValToNative(t));
      if (topics[0] !== "buy_executed") continue;
      const data = scValToNative(ev.data());
      // data shape: [buyer, amount, price, escrow_id]
      if (!Array.isArray(data) || data.length < 4) continue;
      const [buyer, amount] = data;
      if (typeof buyer !== "string") continue;
      if (buyer !== input.buyerAddress) continue;
      const eventAmount =
        typeof amount === "bigint" ? amount.toString() : String(amount);
      if (eventAmount !== input.amountBaseUnits) continue;
      // Topic[2] should be the token contract address; sanity-check.
      if (typeof topics[2] === "string" && topics[2] !== input.tokenContract) {
        continue;
      }
      return true;
    } catch {
      // ignore malformed events
    }
  }
  return false;
}

function collectContractEvents(meta: xdr.TransactionMeta): xdr.ContractEvent[] {
  try {
    if (meta.switch().value === 3) {
      const v3 = meta.v3();
      const txEvents = v3.sorobanMeta()?.events() ?? [];
      const opEvents: xdr.ContractEvent[] = [];
      for (const e of txEvents) opEvents.push(e);
      return opEvents;
    }
    if (meta.switch().value === 4) {
      const v4 = meta.v4();
      const events: xdr.ContractEvent[] = [];
      const sm = v4.sorobanMeta();
      if (sm) {
        for (const e of sm.events()) events.push(e);
      }
      return events;
    }
  } catch {
    // fall through
  }
  return [];
}
