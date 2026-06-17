import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function zodErrorResponse(error: ZodError): NextResponse {
  return NextResponse.json(
    { error: "Invalid request", issues: error.issues },
    { status: 400 }
  );
}

export async function parseJsonBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<{ data: T } | { error: NextResponse }> {
  try {
    const body = await req.json();
    return { data: schema.parse(body) };
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: zodErrorResponse(e) };
    }
    throw e;
  }
}

export function searchParamsToObject(
  searchParams: URLSearchParams
): Record<string, string | undefined> {
  const obj: Record<string, string | undefined> = {};
  searchParams.forEach((value, key) => {
    obj[key] = value;
  });
  return obj;
}

export function parseQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
  try {
    return { data: schema.parse(searchParamsToObject(searchParams)) };
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: zodErrorResponse(e) };
    }
    throw e;
  }
}

export function parseParam<T>(
  value: string,
  schema: ZodSchema<T>
): { data: T } | { error: NextResponse } {
  try {
    return { data: schema.parse(value) };
  } catch (e) {
    if (e instanceof ZodError) {
      return { error: zodErrorResponse(e) };
    }
    throw e;
  }
}
