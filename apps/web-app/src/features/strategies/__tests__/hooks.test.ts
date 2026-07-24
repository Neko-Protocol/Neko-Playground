// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useStrategyComposerState,
  createEmptyStrategy,
  cloneAsEditable,
} from "../hooks";
import type { Strategy } from "@/lib/strategy/types";

describe("createEmptyStrategy / cloneAsEditable", () => {
  it("creates an empty, non-template strategy with a fresh id each time", () => {
    const s1 = createEmptyStrategy();
    const s2 = createEmptyStrategy();
    expect(s1.isTemplate).toBe(false);
    expect(s1.steps).toEqual([]);
    expect(s1.id).not.toBe(s2.id);
  });

  it("clones a template into an editable draft with a new id and isTemplate:false, preserving steps", () => {
    const template: Strategy = {
      id: "template-x",
      version: 1,
      name: "Template X",
      isTemplate: true,
      steps: [
        {
          id: "a",
          type: "swap",
          protocol: "soroswap",
          label: "Swap",
          params: {},
          dependsOn: [],
        },
      ],
      createdAt: 0,
      updatedAt: 0,
    };
    const draft = cloneAsEditable(template);
    expect(draft.id).not.toBe(template.id);
    expect(draft.isTemplate).toBe(false);
    expect(draft.steps).toEqual(template.steps);
  });
});

describe("useStrategyComposerState", () => {
  it("addStep appends a new step with a generated id", () => {
    const { result } = renderHook(() =>
      useStrategyComposerState(createEmptyStrategy())
    );
    act(() =>
      result.current.addStep({
        type: "swap",
        protocol: "soroswap",
        label: "Swap",
        params: {},
        dependsOn: [],
      })
    );
    expect(result.current.strategy.steps).toHaveLength(1);
    expect(result.current.strategy.steps[0].id).toBeTruthy();
  });

  it("moveStep swaps with the neighbor and is a no-op at the boundary", () => {
    const initial = createEmptyStrategy();
    initial.steps = [
      {
        id: "a",
        type: "swap",
        protocol: "soroswap",
        label: "A",
        params: {},
        dependsOn: [],
      },
      {
        id: "b",
        type: "swap",
        protocol: "soroswap",
        label: "B",
        params: {},
        dependsOn: [],
      },
    ];
    const { result } = renderHook(() => useStrategyComposerState(initial));
    act(() => result.current.moveStep("b", "up"));
    expect(result.current.strategy.steps.map((s) => s.id)).toEqual(["b", "a"]);
    act(() => result.current.moveStep("b", "up")); // "b" is now first — no-op
    expect(result.current.strategy.steps.map((s) => s.id)).toEqual(["b", "a"]);
  });

  it("removeStep drops the step and prunes dependent dependsOn/bindings referencing it", () => {
    const initial = createEmptyStrategy();
    initial.steps = [
      {
        id: "a",
        type: "swap",
        protocol: "soroswap",
        label: "A",
        params: {},
        dependsOn: [],
      },
      {
        id: "b",
        type: "vaultDeposit",
        protocol: "defindex",
        label: "B",
        dependsOn: ["a"],
        params: {
          amount: { source: "stepOutput", stepId: "a", portId: "out.amount" },
        },
      },
    ];
    const { result } = renderHook(() => useStrategyComposerState(initial));
    act(() => result.current.removeStep("a"));
    expect(result.current.strategy.steps).toHaveLength(1);
    expect(result.current.strategy.steps[0].dependsOn).toEqual([]);
    expect(result.current.strategy.steps[0].params.amount).toBeUndefined();
  });

  it("updateStepParams replaces a step's params by id, and rename updates the strategy name", () => {
    const initial = createEmptyStrategy("Old");
    initial.steps = [
      {
        id: "a",
        type: "swap",
        protocol: "soroswap",
        label: "A",
        params: {},
        dependsOn: [],
      },
    ];
    const { result } = renderHook(() => useStrategyComposerState(initial));
    act(() =>
      result.current.updateStepParams("a", {
        tokenIn: { source: "literal", value: "XLM" },
      })
    );
    expect(result.current.strategy.steps[0].params).toEqual({
      tokenIn: { source: "literal", value: "XLM" },
    });
    act(() => result.current.rename("New name"));
    expect(result.current.strategy.name).toBe("New name");
  });
});
