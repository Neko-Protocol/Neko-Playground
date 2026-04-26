import { NextResponse } from "next/server";
import { cancelEscrow } from "@/server/trustlessWork";

export const runtime = "nodejs";

interface Body {
  escrowId: string;
  escrowAddress: string;
  tokenContract: string;
  tokenDecimals: number;
  issuerAddress: string;
  remainingBaseUnits: string;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const required = [
    "escrowId",
    "escrowAddress",
    "tokenContract",
    "issuerAddress",
    "remainingBaseUnits",
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

  try {
    const result = await cancelEscrow({
      escrowId: body.escrowId,
      escrowAddress: body.escrowAddress,
      tokenContract: body.tokenContract,
      tokenDecimals: body.tokenDecimals,
      returnTo: body.issuerAddress,
      remainingBaseUnits: body.remainingBaseUnits,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
