import { describe, it, expect } from "vitest";
import { z } from "zod";
import { StrategyStepRegistry } from "../registry";
import { UnknownStepDefinitionError } from "../types";
import type { StrategyStepDefinition } from "../types";

function fakeDefinition(
  stepType: string,
  protocol: string
): StrategyStepDefinition {
  return {
    stepType: stepType as StrategyStepDefinition["stepType"],
    protocol,
    submissionMode: "rpc",
    paramsSchema: z.object({}),
    describeOutputs: () => [],
    validate: () => [],
    simulate: async () => ({ outputs: {}, estimatedFee: "0", warnings: [] }),
    prepare: async () => ({ xdr: "", networkPassphrase: "" }),
  };
}

describe("StrategyStepRegistry", () => {
  it("registers and resolves a definition by (stepType, protocol)", () => {
    const registry = new StrategyStepRegistry();
    const def = fakeDefinition("swap", "soroswap");
    registry.register(def);
    expect(registry.resolve("swap", "soroswap")).toBe(def);
  });

  it("keeps distinct definitions for the same stepType across different protocols", () => {
    const registry = new StrategyStepRegistry();
    const nekoSupply = fakeDefinition("supply", "neko");
    const blendSupply = fakeDefinition("supply", "blend");
    registry.register(nekoSupply);
    registry.register(blendSupply);
    expect(registry.resolve("supply", "neko")).toBe(nekoSupply);
    expect(registry.resolve("supply", "blend")).toBe(blendSupply);
  });

  it("throws UnknownStepDefinitionError for an unregistered key", () => {
    const registry = new StrategyStepRegistry();
    expect(() => registry.resolve("swap", "unknown-protocol")).toThrow(
      UnknownStepDefinitionError
    );
  });

  it("tryResolve returns null instead of throwing for an unregistered key", () => {
    const registry = new StrategyStepRegistry();
    expect(registry.tryResolve("swap", "unknown-protocol")).toBeNull();
  });

  it("has() reflects registration state", () => {
    const registry = new StrategyStepRegistry();
    expect(registry.has("swap", "soroswap")).toBe(false);
    registry.register(fakeDefinition("swap", "soroswap"));
    expect(registry.has("swap", "soroswap")).toBe(true);
  });

  it("listRegistered returns every registered definition", () => {
    const registry = new StrategyStepRegistry();
    registry.register(fakeDefinition("swap", "soroswap"));
    registry.register(fakeDefinition("supply", "neko"));
    expect(registry.listRegistered()).toHaveLength(2);
  });

  it("overwrites a definition registered twice under the same key", () => {
    const registry = new StrategyStepRegistry();
    const first = fakeDefinition("swap", "soroswap");
    const second = fakeDefinition("swap", "soroswap");
    registry.register(first);
    registry.register(second);
    expect(registry.resolve("swap", "soroswap")).toBe(second);
    expect(registry.listRegistered()).toHaveLength(1);
  });

  it("resolveOrUnknown returns the real definition when registered", () => {
    const registry = new StrategyStepRegistry();
    const def = fakeDefinition("swap", "soroswap");
    registry.register(def);
    expect(registry.resolveOrUnknown("swap", "soroswap")).toBe(def);
  });

  it("resolveOrUnknown falls back to a graceful unknown-step definition instead of throwing", () => {
    const registry = new StrategyStepRegistry();
    const fallback = registry.resolveOrUnknown("teleport", "futureProtocol");
    expect(fallback.stepType).toBe("teleport");
    expect(fallback.protocol).toBe("futureProtocol");
    expect(
      fallback.validate({
        userAddress: "G",
        networkPassphrase: "p",
        resolvedParams: {},
        upstreamOutputs: {},
      })
    ).toEqual([expect.objectContaining({ code: "UNKNOWN_STEP_TYPE" })]);
  });

  it("the unknown-step fallback's simulate/prepare reject rather than fabricating a result", async () => {
    const registry = new StrategyStepRegistry();
    const fallback = registry.resolveOrUnknown("teleport", "futureProtocol");
    const ctx = {
      userAddress: "G",
      networkPassphrase: "p",
      resolvedParams: {},
      upstreamOutputs: {},
    };
    await expect(fallback.simulate(ctx)).rejects.toThrow(
      /Unrecognized step type/
    );
    await expect(fallback.prepare(ctx)).rejects.toThrow(
      /Unrecognized step type/
    );
    expect(fallback.describeOutputs({})).toEqual([]);
  });
});
