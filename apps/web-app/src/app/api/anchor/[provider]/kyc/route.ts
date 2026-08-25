import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleRouteError } from "@/lib/anchors/http";
import { AlfredPayClient } from "@/lib/anchors/alfredpay";
import {
  parseJsonBody,
  parseParam,
  parseQuery,
  zodErrorResponse,
} from "@/lib/validation/parse";
import {
  KycFileUploadSchema,
  KycGetQuerySchema,
  KycPostTypeSchema,
  KycSubmitFormFieldsSchema,
  KycSubmitJsonBodySchema,
  ProviderSchema,
} from "@/lib/validation/schemas";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const { searchParams } = new URL(request.url);
    const queryResult = parseQuery(searchParams, KycGetQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const {
      customerId,
      type = "status",
      country = "MX",
      publicKey,
      bankAccountId,
    } = queryResult.data;

    const client = getAnchorClient(provider);

    if (type === "requirements") {
      if (!client.getKycRequirements) {
        return NextResponse.json(
          { error: "Provider does not support KYC requirements" },
          { status: 400 }
        );
      }
      const requirements = await client.getKycRequirements(
        country,
        request.signal
      );
      return NextResponse.json(requirements);
    }

    if (type === "iframe" || type === "url") {
      if (!client.getKycUrl) {
        return NextResponse.json(
          { error: "Provider does not support KYC URL generation" },
          { status: 501 }
        );
      }
      const kycUrl = await client.getKycUrl(
        customerId!,
        publicKey,
        bankAccountId,
        request.signal
      );
      return NextResponse.json({ url: kycUrl });
    }

    if (type === "submission" && client instanceof AlfredPayClient) {
      const submission = await client.getKycSubmission(
        customerId!,
        request.signal
      );
      return NextResponse.json({ submission });
    }

    const status = await client.getKycStatus(
      customerId!,
      publicKey,
      request.signal
    );
    return NextResponse.json({ status });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");
    const typeResult = parseParam(typeParam ?? "", KycPostTypeSchema);
    if ("error" in typeResult) {
      return NextResponse.json(
        { error: 'type query parameter must be "submit-kyc" or "file"' },
        { status: 400 }
      );
    }
    const type = typeResult.data;

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

        let fields: Record<string, string>;
        let metadata: Record<string, string> | undefined;
        try {
          fields = JSON.parse(formData.get("fields") as string);
          metadata = formData.has("metadata")
            ? JSON.parse(formData.get("metadata") as string)
            : undefined;
        } catch {
          return NextResponse.json(
            {
              error: "Invalid request",
              issues: [{ message: "Invalid JSON in form fields" }],
            },
            { status: 400 }
          );
        }

        const formParsed = KycSubmitFormFieldsSchema.safeParse({
          customerId: formData.get("customerId"),
          fields,
          metadata,
        });
        if (!formParsed.success) {
          return zodErrorResponse(formParsed.error);
        }

        const documents: Record<string, File | string> = {};
        for (const [key, value] of formData.entries()) {
          if (key.startsWith("doc_")) {
            documents[key.slice(4)] = value as File | string;
          }
        }

        const result = await client.submitKyc(
          formParsed.data.customerId,
          {
            fields: formParsed.data.fields,
            documents,
            metadata: formParsed.data.metadata,
          },
          request.signal
        );
        return NextResponse.json(result);
      }

      const parsed = await parseJsonBody(request, KycSubmitJsonBodySchema);
      if ("error" in parsed) return parsed.error;
      const { customerId, data } = parsed.data;
      const result = await client.submitKyc(
        customerId,
        {
          fields: data.fields,
          documents: data.documents ?? {},
          metadata: data.metadata,
        },
        request.signal
      );
      return NextResponse.json(result);
    }

    if (type === "file" && client instanceof AlfredPayClient) {
      const formData = await request.formData();
      const file = formData.get("file");

      const fileParsed = KycFileUploadSchema.safeParse({
        customerId: formData.get("customerId"),
        submissionId: formData.get("submissionId"),
        fileType: formData.get("fileType"),
      });
      if (!fileParsed.success) {
        return zodErrorResponse(fileParsed.error);
      }
      if (!(file instanceof File)) {
        return NextResponse.json(
          {
            error: "Invalid request",
            issues: [{ message: "file is required", path: ["file"] }],
          },
          { status: 400 }
        );
      }

      const { customerId, submissionId, fileType } = fileParsed.data;
      const result = await client.submitKycFile(
        customerId,
        submissionId,
        fileType,
        file,
        file.name,
        request.signal
      );
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'type query parameter must be "submit-kyc" or "file"' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }
    return handleRouteError(error);
  }
}
