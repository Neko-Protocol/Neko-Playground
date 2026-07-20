import { describe, it, expect } from "vitest";
import "../definitions"; // registers the real built-in step definitions
import { STRATEGY_TEMPLATES, findTemplate } from "../templates";
import { validateStrategy, topologicalSort } from "../engine";

/**
 * Templates ship with placeholder literal params (e.g. empty pool/asset
 * addresses the user fills in via the composer before executing), so they
 * intentionally are NOT expected to be issue-free — only structurally
 * sound: acyclic, every dependency declared and resolvable, every step
 * type actually registered. Parameter-completeness is the composer's/
 * simulate-time's concern, not template authoring's.
 */
const STRUCTURAL_CODES = new Set([
  "INVALID_DEPENDENCY",
  "UNDECLARED_DEPENDENCY",
  "CIRCULAR_DEPENDENCY",
  "UNSUPPORTED_STEP",
  "INCOMPATIBLE_ASSET",
]);

describe("STRATEGY_TEMPLATES — structural validity", () => {
  it("ships exactly 4 templates, matching the spec's named list", () => {
    expect(STRATEGY_TEMPLATES.map((t) => t.name)).toEqual([
      "Swap → Vault Deposit",
      "Leveraged Supply",
      "Position Unwind",
      "Single Asset Liquidity Position",
    ]);
  });

  it.each(STRATEGY_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s has an acyclic, fully-ordered step graph",
    (_name, template) => {
      const { order, issues } = topologicalSort(template.steps);
      expect(issues).toEqual([]);
      expect(order).toHaveLength(template.steps.length);
    }
  );

  it.each(STRATEGY_TEMPLATES.map((t) => [t.name, t] as const))(
    "%s has no structural, dependency, or unsupported-step-type issues",
    (_name, template) => {
      const result = validateStrategy(template);
      const structuralIssues = result.issues.filter((i) =>
        STRUCTURAL_CODES.has(i.code)
      );
      expect(structuralIssues).toEqual([]);
    }
  );

  it("every template is marked isTemplate:true and cloneAsEditable produces isTemplate:false", async () => {
    const { cloneAsEditable } =
      await import("../../../features/strategies/hooks");
    for (const template of STRATEGY_TEMPLATES) {
      expect(template.isTemplate).toBe(true);
      expect(cloneAsEditable(template).isTemplate).toBe(false);
    }
  });

  it("findTemplate resolves a known id and returns undefined for an unknown one", () => {
    expect(findTemplate(STRATEGY_TEMPLATES[0].id)?.name).toBe(
      STRATEGY_TEMPLATES[0].name
    );
    expect(findTemplate("does-not-exist")).toBeUndefined();
  });
});
