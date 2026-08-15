import { NextRequest, NextResponse } from "next/server";
import { getAnchorClient } from "@/lib/anchors";
import { handleAnchorError } from "@/lib/anchors/handleAnchorError";
import { AlfredPayClient } from "@/lib/anchors/alfredpay";
import { EtherfuseClient } from "@/lib/anchors/etherfuse";
import { BadRequestError } from "@/lib/auth/errors";
import { assertOwnsCustomer } from "@/lib/auth/ownership";
import { requireSession } from "@/lib/auth/requireSession";
import { assertRateLimit } from "@/lib/rateLimit";
import {
  parseJsonBody,
  parseParam,
  parseQuery,
  zodErrorResponse,
} from "@/lib/validation/parse";
import {
  KYC_ALLOWED_MIME_TYPES,
  KYC_MAX_DOC_COUNT,
  KYC_MAX_FILE_BYTES,
  KycFileUploadSchema,
  KycGetQuerySchema,
  KycPostTypeSchema,
  KycSubmitFormFieldsSchema,
  KycSubmitJsonBodySchema,
  ProviderSchema,
} from "@/lib/validation/schemas";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

function validateKycDocuments(documents: Record<string, File | string>): void {
  const entries = Object.entries(documents);
  if (entries.length > KYC_MAX_DOC_COUNT) {
    throw new BadRequestError(`Maximum ${KYC_MAX_DOC_COUNT} documents allowed`);
  }

  for (const [, value] of entries) {
    if (value instanceof File) {
      if (value.size > KYC_MAX_FILE_BYTES) {
        throw new BadRequestError("Document exceeds maximum file size");
      }
      if (
        value.type &&
        !KYC_ALLOWED_MIME_TYPES.includes(
          value.type as (typeof KYC_ALLOWED_MIME_TYPES)[number]
        )
      ) {
        throw new BadRequestError("Document MIME type is not allowed");
      }
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const sessionResult = requireSession(request);
    if (sessionResult.error) return sessionResult.error;
    const session = sessionResult.session;

    const { provider: providerParam } = await params;
    const providerResult = parseParam(providerParam, ProviderSchema);
    if ("error" in providerResult) return providerResult.error;
    const provider = providerResult.data;

    await assertRateLimit(request, session);

    const { searchParams } = new URL(request.url);
    const queryResult = parseQuery(searchParams, KycGetQuerySchema);
    if ("error" in queryResult) return queryResult.error;
    const {
      customerId,
      type = "status",
      country = "MX",
      bankAccountId,
    } = queryResult.data;

    if (customerId) {
      await assertOwnsCustomer(session, provider, customerId);
    }

    const client = getAnchorClient(provider);
    const publicKey = session.publicKey;

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

      let kycUrl: string;
      if (client instanceof AlfredPayClient) {
        kycUrl = await client.getKycUrl(customerId!, country);
      } else if (client instanceof EtherfuseClient) {
        kycUrl = await client.getKycUrl(
          customerId!,
          publicKey,
          bankAccountId
        );
      } else {
        kycUrl = await client.getKycUrl(customerId!, publicKey, bankAccountId);
      }

      return NextResponse.json({ url: kycUrl });
    }

    if (type === "submission" && client instanceof AlfredPayClient) {
      const submission = await client.getKycSubmission(customerId!);
      return NextResponse.json({ submission });
    }

    const status = await client.getKycStatus(customerId!, publicKey);
    return NextResponse.json({ status });
  } catch (error) {
    return handleAnchorError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const sessionResult = requireSession(request);
    if (sessionResult.error) return sessionResult.error;
    const session = sessionResult.session;

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

    const rateBucket = type === "file" ? "anchor-kyc-upload" : "anchor-default";
    await assertRateLimit(request, session, rateBucket);

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

        await assertOwnsCustomer(
          session,
          provider,
          formParsed.data.customerId
        );

        const documents: Record<string, File | string> = {};
        for (const [key, value] of formData.entries()) {
          if (key.startsWith("doc_")) {
            documents[key.slice(4)] = value as File | string;
          }
        }

        validateKycDocuments(documents);

        const result = await client.submitKyc(formParsed.data.customerId, {
          fields: formParsed.data.fields,
          documents,
          metadata: formParsed.data.metadata,
        });
        return NextResponse.json(result);
      }

      const parsed = await parseJsonBody(request, KycSubmitJsonBodySchema);
      if ("error" in parsed) return parsed.error;
      const { customerId, data } = parsed.data;

      await assertOwnsCustomer(session, provider, customerId);

      const result = await client.submitKyc(customerId, {
        fields: data.fields,
        documents: data.documents ?? {},
        metadata: data.metadata,
      });
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

      if (file.size > KYC_MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: "File exceeds maximum size" },
          { status: 400 }
        );
      }
      if (
        file.type &&
        !KYC_ALLOWED_MIME_TYPES.includes(
          file.type as (typeof KYC_ALLOWED_MIME_TYPES)[number]
        )
      ) {
        return NextResponse.json(
          { error: "File MIME type is not allowed" },
          { status: 400 }
        );
      }

      const { customerId, submissionId, fileType } = fileParsed.data;
      await assertOwnsCustomer(session, provider, customerId);

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
    if (error instanceof ZodError) {
      return zodErrorResponse(error);
    }
    return handleAnchorError(error);
  }
}
