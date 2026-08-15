import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AnchorError } from "@/lib/anchors";
import {
  BadRequestError,
  ForbiddenError,
  RateLimitError,
  UnauthorizedError,
} from "@/lib/auth/errors";
import { zodErrorResponse } from "@/lib/validation/parse";

export function handleAnchorError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (error instanceof RateLimitError) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  if (error instanceof BadRequestError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof ZodError) {
    return zodErrorResponse(error);
  }

  if (error instanceof AnchorError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error("[anchor]", error);

  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
