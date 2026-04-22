import { NextResponse } from "next/server";
import { createDiditSession, workflowIdForLevel } from "@/server/didit";
import { kycStore } from "@/server/kycStore";
import type { KycEntry } from "@/types";

export async function POST(req: Request) {
  try {
    const { stellarAddress, kycLevel } = (await req.json()) as {
      stellarAddress?: string;
      kycLevel?: KycEntry["kycLevel"];
    };
    if (!stellarAddress || !kycLevel) {
      return NextResponse.json(
        { error: "stellarAddress and kycLevel are required" },
        { status: 400 }
      );
    }

    const isMock = process.env.NEXT_PUBLIC_DIDIT_MOCK === "true";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl && !isMock) {
      return NextResponse.json(
        {
          error:
            "Set NEXT_PUBLIC_APP_URL to your public ngrok URL before starting a KYC session (restart dev server after editing .env.local).",
        },
        { status: 500 }
      );
    }

    const resolvedAppUrl = appUrl || "http://localhost:3001";

    const { sessionId, verificationUrl } = await createDiditSession({
      workflowId: workflowIdForLevel(kycLevel),
      referenceId: stellarAddress,
      callbackUrl: `${resolvedAppUrl}/api/kyc/webhook`,
    });

    kycStore.createSession({ sessionId, stellarAddress, kycLevel });

    console.info(
      "[kyc/create-session] created",
      sessionId,
      "->",
      verificationUrl
    );

    return NextResponse.json({ sessionId, verificationUrl });
  } catch (err) {
    console.error("[kyc/create-session]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
