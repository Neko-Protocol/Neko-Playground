import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient, isValidProvider, AnchorError } from "@/lib/anchors";
import { AlfredPayClient } from "@/lib/anchors/alfredpay";
import type { AlfredPayKycFileType } from "@/lib/anchors/alfredpay/types";

export const dynamic = "force-dynamic";

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
    const customerId = searchParams.get("customerId") || undefined;
    const type = searchParams.get("type") || "status";
    const country = searchParams.get("country") || "MX";
    const publicKey = searchParams.get("publicKey") || undefined;

    const client = getAnchorClient(provider);

    if (type === "requirements") {
      if (!client.getKycRequirements) {
        return NextResponse.json(
          { error: "Provider does not support KYC requirements" },
          { status: 400 }
        );
      }
      const requirements = await client.getKycRequirements(country);
      return NextResponse.json(requirements);
    }

    if (type === "iframe" || type === "url") {
      if (!client.getKycUrl) {
        return NextResponse.json(
          { error: "Provider does not support KYC URL generation" },
          { status: 501 }
        );
      }
      if (!customerId) {
        return NextResponse.json(
          { error: "customerId query parameter is required" },
          { status: 400 }
        );
      }
      const bankAccountId = searchParams.get("bankAccountId") || undefined;
      const kycUrl = await client.getKycUrl(
        customerId,
        publicKey,
        bankAccountId
      );
      return NextResponse.json({ url: kycUrl });
    }

    if (type === "submission" && client instanceof AlfredPayClient) {
      if (!customerId) {
        return NextResponse.json(
          { error: "customerId query parameter is required" },
          { status: 400 }
        );
      }
      const submission = await client.getKycSubmission(customerId);
      return NextResponse.json({ submission });
    }

    // Default: return status
    if (!customerId) {
      return NextResponse.json(
        { error: "customerId query parameter is required" },
        { status: 400 }
      );
    }
    const status = await client.getKycStatus(customerId, publicKey);
    return NextResponse.json({ status });
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const client = getAnchorClient(provider);

    if (type === "submit-kyc") {
      if (!client.submitKyc) {
        return NextResponse.json(
          { error: "Provider does not support KYC submission" },
          { status: 400 }
        );
      }

      const contentType = request.headers.get("content-type") || "";

      if (contentType.includes("multipart/form-data")) {
        const formData = await request.formData();
        const customerId = formData.get("customerId") as string;
        const fields = JSON.parse(formData.get("fields") as string);
        const metadata = formData.has("metadata")
          ? JSON.parse(formData.get("metadata") as string)
          : undefined;

        const documents: Record<string, File | string> = {};
        for (const [key, value] of formData.entries()) {
          if (key.startsWith("doc_")) {
            documents[key.slice(4)] = value as File | string;
          }
        }

        const result = await client.submitKyc(customerId, {
          fields,
          documents,
          metadata,
        });
        return NextResponse.json(result);
      } else {
        const body = await request.json();
        const { customerId, data } = body;
        const result = await client.submitKyc(customerId, data);
        return NextResponse.json(result);
      }
    }

    // AlfredPay-specific: file upload
    if (type === "file" && client instanceof AlfredPayClient) {
      const formData = await request.formData();
      const customerId = formData.get("customerId") as string;
      const submissionId = formData.get("submissionId") as string;
      const fileType = formData.get("fileType") as AlfredPayKycFileType;
      const file = formData.get("file") as File;

      if (!customerId || !submissionId || !fileType || !file) {
        return NextResponse.json(
          {
            error: "customerId, submissionId, fileType, and file are required",
          },
          { status: 400 }
        );
      }

      const result = await client.submitKycFile(
        customerId,
        submissionId,
        fileType,
        file,
        file.name
      );
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'type query parameter must be "submit-kyc" or "file"' },
      { status: 400 }
    );
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
