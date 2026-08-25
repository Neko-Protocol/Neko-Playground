import { NextResponse } from "next/server";
import {
  AnchorError,
  AnchorTimeoutError,
  AnchorUnreachableError,
} from "./types";

export const ANCHOR_REQUEST_TIMEOUT_MS = 15_000;

export interface AnchorRequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function isTimeoutAbort(signal: AbortSignal): boolean {
  return signal.aborted && signal.reason === "timeout";
}

function combineSignals(
  timeoutMs: number,
  callerSignal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort("timeout");
  }, timeoutMs);

  const onCallerAbort = () => {
    timeoutController.abort(callerSignal?.reason);
  };

  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timeoutId);
      timeoutController.abort(callerSignal.reason);
    } else {
      callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  const cleanup = () => {
    clearTimeout(timeoutId);
    if (callerSignal) {
      callerSignal.removeEventListener("abort", onCallerAbort);
    }
  };

  return { signal: timeoutController.signal, cleanup };
}

export async function anchorRequest(
  url: string,
  init: RequestInit = {},
  options: AnchorRequestOptions = {}
): Promise<Response> {
  const timeoutMs = options.timeoutMs ?? ANCHOR_REQUEST_TIMEOUT_MS;
  const { signal, cleanup } = combineSignals(timeoutMs, options.signal);

  try {
    if (signal.aborted) {
      if (isTimeoutAbort(signal)) {
        throw new AnchorTimeoutError();
      }
      throw new DOMException("Aborted", "AbortError");
    }

    const response = await fetch(url, { ...init, signal });
    return response;
  } catch (error) {
    if (isAbortError(error)) {
      if (isTimeoutAbort(signal)) {
        throw new AnchorTimeoutError();
      }
      throw error;
    }

    if (error instanceof AnchorError) {
      throw error;
    }

    throw new AnchorUnreachableError(
      error instanceof Error ? error.message : "Anchor is unreachable"
    );
  } finally {
    cleanup();
  }
}

export function anchorErrorResponse(error: unknown): NextResponse | null {
  if (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  ) {
    return null;
  }

  if (error instanceof AnchorTimeoutError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof AnchorUnreachableError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

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

export function raceWithSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    promise
      .then((value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      })
      .catch((error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      });
  });
}

export function disconnectedResponse(): NextResponse {
  return new NextResponse(null, { status: 499 });
}

export function handleRouteError(error: unknown): NextResponse {
  const response = anchorErrorResponse(error);
  return response ?? disconnectedResponse();
}
