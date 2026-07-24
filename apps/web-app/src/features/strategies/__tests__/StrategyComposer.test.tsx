// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { StepCard } from "../components/StrategyComposer";
import type { Strategy, StrategyStep } from "@/lib/strategy/types";

afterEach(cleanup);

const step: StrategyStep = {
  id: "a",
  type: "swap",
  protocol: "soroswap",
  label: "Swap XLM to USDC",
  params: { tokenIn: { source: "literal", value: "XLM" } },
  dependsOn: [],
};

const strategy: Strategy = {
  id: "s1",
  version: 1,
  name: "Test",
  isTemplate: false,
  steps: [step],
  createdAt: 0,
  updatedAt: 0,
};

describe("StepCard — keyboard-operable reordering and accessibility", () => {
  it("exposes labeled Move Up / Move Down / Remove buttons reachable by role+name (keyboard/screen-reader path)", () => {
    render(
      <StepCard
        strategy={strategy}
        step={step}
        index={0}
        total={2}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onParamsChange={vi.fn()}
      />
    );
    expect(
      screen.getByRole("button", { name: /move swap xlm to usdc up/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /move swap xlm to usdc down/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /remove swap xlm to usdc/i })
    ).toBeTruthy();
  });

  it("disables Move Up for the first step and Move Down for the last step", () => {
    render(
      <StepCard
        strategy={strategy}
        step={step}
        index={0}
        total={1}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onParamsChange={vi.fn()}
      />
    );
    expect(
      (
        screen.getByRole("button", {
          name: /move swap xlm to usdc up/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: /move swap xlm to usdc down/i,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true);
  });

  it("clicking Move Down calls onMove('down'), Remove calls onRemove", () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    render(
      <StepCard
        strategy={strategy}
        step={step}
        index={0}
        total={2}
        onMove={onMove}
        onRemove={onRemove}
        onParamsChange={vi.fn()}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: /move swap xlm to usdc down/i })
    );
    expect(onMove).toHaveBeenCalledWith("down");
    fireEvent.click(
      screen.getByRole("button", { name: /remove swap xlm to usdc/i })
    );
    expect(onRemove).toHaveBeenCalled();
  });

  it("expanding the card reveals the params form with the existing param visible", () => {
    render(
      <StepCard
        strategy={strategy}
        step={step}
        index={0}
        total={2}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onParamsChange={vi.fn()}
      />
    );
    const toggle = screen.getByRole("button", {
      name: /edit swap xlm to usdc parameters/i,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("tokenIn")).toBeTruthy();
  });
});
