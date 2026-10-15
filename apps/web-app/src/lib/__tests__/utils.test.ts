import { describe, it, expect } from "vitest";
import { cn, truncateAddress } from "../utils";

// ─── cn() ────────────────────────────────────────────────────────────────────

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("merges conflicting Tailwind classes, last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles conditional values like clsx", () => {
    expect(cn("base", false && "hidden", undefined, "visible")).toBe(
      "base visible"
    );
  });

  it("merges conflicting classes inside conditional objects", () => {
    expect(cn("text-sm", { "text-lg": true, "text-sm": false })).toBe(
      "text-lg"
    );
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});

// ─── truncateAddress ─────────────────────────────────────────────────────────

describe("truncateAddress", () => {
  it("truncates a long address with an ellipsis", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOP")).toBe("GABC…MNOP");
  });

  it("returns short values unchanged", () => {
    expect(truncateAddress("GABC")).toBe("GABC");
  });

  it("respects custom start/end lengths", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOP", 2, 2)).toBe("GA…OP");
  });
});
