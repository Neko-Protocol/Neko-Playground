import { describe, it, expect } from "vitest";
import { maskWallet, redactString, redactValue, redactError } from "../redact";
import { configureLogger, logger, resetLoggerForTests } from "../logger";

describe("redact", () => {
  it("masks stellar and evm wallets in strings", () => {
    const stellar = "G" + "A".repeat(55);
    const evm = "0x" + "ab".repeat(20);
    expect(redactString(`wallet=${stellar}`)).not.toContain(stellar);
    expect(redactString(`wallet=${stellar}`)).toContain("…");
    expect(redactString(evm)).toBe(maskWallet(evm));
  });

  it("redacts bearer tokens, JWTs, and XDR-like blobs", () => {
    const out = redactString(
      "Bearer super-secret-token-value eyJhbGciOiJIUzI1NiJ9.payload.signature AAAA" +
        "B".repeat(48) +
        "=="
    );
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("super-secret-token-value");
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("redacts sensitive object keys without leaving wallet/token verbatim", () => {
    const stellar = "G" + "C".repeat(55);
    const input = {
      walletAddress: stellar,
      token: "session-secret",
      signedXdr: "AAAA" + "D".repeat(60),
      nested: { apiKey: "abc123", ok: true },
      safe: "hello",
    };
    const out = redactValue(input) as Record<string, unknown>;
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain(stellar);
    expect(serialized).not.toContain("session-secret");
    expect(serialized).not.toContain("abc123");
    expect(out.safe).toBe("hello");
    expect((out.nested as { ok: boolean }).ok).toBe(true);
  });

  it("redacts error messages that embed wallets", () => {
    const stellar = "G" + "E".repeat(55);
    const err = redactError(new Error(`swap failed for ${stellar}`));
    expect(String(err.message)).not.toContain(stellar);
  });

  it("redacts sensitive error names in the JSON log and retains safe names", () => {
    const names = [
      "Bearer synthetic-name-token",
      "G" + "A".repeat(55),
      "eyJhbGciOiJIUzI1NiJ9.payload.signature",
      "AAAA" + "B".repeat(48) + "==",
      "TypeError",
    ];
    const lines: string[] = [];
    configureLogger({ sink: (line) => lines.push(line) });
    try {
      for (const name of names) {
        const err = new Error("ordinary failure");
        err.name = name;
        err.stack = "Error: ordinary failure";
        logger.error("provider_failure", {
          requestId: "request-name-1",
          route: "/api/vault/apy",
          err,
        });
        const line = lines[lines.length - 1];
        const entry = JSON.parse(line);
        expect(entry.err.name).toBe(redactString(name));
        expect(entry.err.message).toBe("ordinary failure");
        expect(entry.err.stack).toBe("Error: ordinary failure");
        expect(entry.requestId).toBe("request-name-1");
        expect(entry.route).toBe("/api/vault/apy");
        expect(err.name).toBe(name);
        if (name !== "TypeError") expect(line).not.toContain(name);
      }
      expect(lines).toHaveLength(names.length);
    } finally {
      resetLoggerForTests();
    }
  });

  it("cuts object, array, and mutual ancestor cycles without losing redaction", () => {
    const object: Record<string, unknown> = { token: "cycle-secret", safe: true };
    object.self = object;
    expect(redactValue(object)).toEqual({
      token: "[REDACTED]",
      safe: true,
      self: "[Circular]",
    });

    const array: unknown[] = ["Bearer array-secret"];
    array.push(array);
    expect(redactValue(array)).toEqual(["Bearer [REDACTED]", "[Circular]"]);

    const left: Record<string, unknown> = { safe: "left" };
    const right = { token: "mutual-secret", left };
    left.right = right;
    expect(redactValue(left)).toEqual({
      safe: "left",
      right: { token: "[REDACTED]", left: "[Circular]" },
    });
  });

  it("retains shared acyclic values in every position and redaction call", () => {
    const shared = Object.freeze({ token: "shared-secret", safe: "retained" });
    const input = Object.freeze({
      first: shared,
      second: shared,
      list: Object.freeze([shared, shared]),
    });
    const expected = {
      first: { token: "[REDACTED]", safe: "retained" },
      second: { token: "[REDACTED]", safe: "retained" },
      list: [
        { token: "[REDACTED]", safe: "retained" },
        { token: "[REDACTED]", safe: "retained" },
      ],
    };
    expect(redactValue(input)).toEqual(expected);
    expect(redactValue(input)).toEqual(expected);
    expect(shared.token).toBe("shared-secret");
  });

  it("emits one safe JSON log for frozen cyclic diagnostic context", () => {
    const lines: string[] = [];
    const details: Record<string, unknown> = {
      token: "log-secret",
      safe: "retained",
    };
    details.self = details;
    Object.freeze(details);
    configureLogger({ sink: (line) => lines.push(line) });
    try {
      logger.error("cyclic_context", { requestId: "request-cycle-1", details });
      expect(lines).toHaveLength(1);
      const entry = JSON.parse(lines[0]);
      expect(entry.level).toBe("error");
      expect(entry.msg).toBe("cyclic_context");
      expect(entry.requestId).toBe("request-cycle-1");
      expect(entry.details).toEqual({
        token: "[REDACTED]",
        safe: "retained",
        self: "[Circular]",
      });
      expect(lines[0]).not.toContain("log-secret");
      expect(details.self).toBe(details);
      expect(details.token).toBe("log-secret");
    } finally {
      resetLoggerForTests();
    }
  });
});
