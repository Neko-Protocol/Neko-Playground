import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import {
  errorResponse,
  REQUEST_ID_HEADER,
  resolveRequestId,
} from "../errorResponse";
import { configureLogger, logger, resetLoggerForTests } from "../logger";

const sensitiveIds = [
  ["Stellar wallet", "G" + "A".repeat(55)],
  ["EVM wallet", "0x" + "ab".repeat(20)],
  ["bearer token", "Bearer synthetic-token-for-local-validation"],
  ["JWT", "eyJhbGciOiJIUzI1NiJ9.syntheticPayload.syntheticSignature"],
  ["signed XDR", "AAAA" + "B".repeat(60) + "=="],
] as const;

describe("correlation metadata privacy", () => {
  const lines: string[] = [];

  beforeEach(() => {
    lines.length = 0;
    configureLogger({ sink: (line) => lines.push(line) });
  });

  afterEach(resetLoggerForTests);

  it.each(sensitiveIds)(
    "replaces a %s once and keeps request, response, and log correlated",
    async (_label, incomingId) => {
      const request = new NextRequest("http://localhost/api/local", {
        headers: { [REQUEST_ID_HEADER]: incomingId },
      });
      const forwarded = middleware(request);
      const requestId = forwarded.headers.get(REQUEST_ID_HEADER);
      expect(requestId).toBeTruthy();
      expect(requestId).not.toBe(incomingId);
      expect(
        forwarded.headers.get(`x-middleware-request-${REQUEST_ID_HEADER}`)
      ).toBe(requestId);

      request.headers.set(REQUEST_ID_HEADER, requestId!);
      const response = errorResponse(
        new Error("local dependency unavailable"),
        {
          req: request,
          route: "/api/local",
        }
      );
      const body = await response.json();
      expect(response.status).toBe(500);
      expect(response.headers.get(REQUEST_ID_HEADER)).toBe(requestId);
      expect(body.requestId).toBe(requestId);
      expect(JSON.parse(lines[0]).requestId).toBe(requestId);
      expect(JSON.stringify([body, lines])).not.toContain(incomingId);
    }
  );

  it("normalizes an explicit error-helper request ID before logging", async () => {
    const incomingId = sensitiveIds[0][1];
    const response = errorResponse(new Error("local failure"), {
      requestId: incomingId,
      route: "/api/local",
    });
    const body = await response.json();
    expect(body.requestId).not.toBe(incomingId);
    expect(response.headers.get(REQUEST_ID_HEADER)).toBe(body.requestId);
    expect(JSON.parse(lines[0]).requestId).toBe(body.requestId);
    expect(lines[0]).not.toContain(incomingId);
  });

  it.each([REQUEST_ID_HEADER, "x-correlation-id"])(
    "preserves an ordinary incoming ID from %s",
    async (header) => {
      const request = new NextRequest("http://localhost/api/local", {
        headers: { [header]: "ordinary-client-42" },
      });
      expect(resolveRequestId(request)).toBe("ordinary-client-42");
      const forwarded = middleware(request);
      expect(forwarded.headers.get(REQUEST_ID_HEADER)).toBe(
        "ordinary-client-42"
      );
      request.headers.set(REQUEST_ID_HEADER, "ordinary-client-42");
      const response = errorResponse(new Error("local failure"), {
        req: request,
      });
      expect((await response.json()).requestId).toBe("ordinary-client-42");
      expect(JSON.parse(lines[0]).requestId).toBe("ordinary-client-42");
    }
  );

  it.each(["requestId", "route", "msg"])(
    "applies the existing redaction policy to top-level %s",
    (field) => {
      for (const [_label, value] of sensitiveIds) {
        lines.length = 0;
        if (field === "msg") {
          logger.error(value, {
            requestId: "ordinary-client-42",
            route: "/api/local",
          });
        } else {
          logger.error("local_failure", { [field]: value });
        }
        expect(lines).toHaveLength(1);
        expect(lines[0]).not.toContain(value);
      }
    }
  );
});
