// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  TemplatePicker,
  ResumeExecutionBanner,
} from "../components/Strategies";
import { STRATEGY_TEMPLATES } from "@/lib/strategy/templates";
import type { ExecutionRecord } from "@/lib/strategy/types";

afterEach(cleanup);

describe("TemplatePicker", () => {
  it("renders one card per built-in template", () => {
    render(<TemplatePicker onUseTemplate={vi.fn()} />);
    for (const template of STRATEGY_TEMPLATES) {
      expect(screen.getByText(template.name)).toBeTruthy();
    }
  });

  it("clicking 'Use template' calls onUseTemplate with that exact template", () => {
    const onUseTemplate = vi.fn();
    render(<TemplatePicker onUseTemplate={onUseTemplate} />);
    const firstTemplate = STRATEGY_TEMPLATES[0];
    const buttons = screen.getAllByRole("button", { name: /use template/i });
    fireEvent.click(buttons[0]);
    expect(onUseTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ id: firstTemplate.id, isTemplate: true })
    );
  });

  it("every template card exposes an accessible button (keyboard reachable)", () => {
    render(<TemplatePicker onUseTemplate={vi.fn()} />);
    const buttons = screen.getAllByRole("button", { name: /use template/i });
    expect(buttons).toHaveLength(STRATEGY_TEMPLATES.length);
    buttons.forEach((btn) => expect(btn.tagName).toBe("BUTTON"));
  });
});

function execution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: "e1",
    strategyId: "s1",
    strategySnapshot: {},
    status: "in_progress",
    startedAt: 0,
    updatedAt: 0,
    projectedOutcome: {},
    steps: [
      { stepId: "a", status: "completed" },
      { stepId: "b", status: "pending" },
    ],
    ...overrides,
  };
}

describe("ResumeExecutionBanner", () => {
  it("renders nothing when there are no unfinished executions", () => {
    const { container } = render(
      <ResumeExecutionBanner
        executions={[]}
        onResume={vi.fn()}
        onAbandon={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("shows progress and mentions the deviation pause explicitly for a paused-deviation execution", () => {
    render(
      <ResumeExecutionBanner
        executions={[execution()]}
        onResume={vi.fn()}
        onAbandon={vi.fn()}
      />
    );
    expect(screen.getByText(/1\/2 steps completed/)).toBeTruthy();

    render(
      <ResumeExecutionBanner
        executions={[execution({ status: "paused-deviation" })]}
        onResume={vi.fn()}
        onAbandon={vi.fn()}
      />
    );
    expect(screen.getByText(/paused on a deviation/)).toBeTruthy();
  });

  it("Continue calls onResume and Abandon calls onAbandon with that execution", () => {
    const onResume = vi.fn();
    const onAbandon = vi.fn();
    const exec = execution();
    render(
      <ResumeExecutionBanner
        executions={[exec]}
        onResume={onResume}
        onAbandon={onAbandon}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(onResume).toHaveBeenCalledWith(exec);
    fireEvent.click(screen.getByRole("button", { name: /abandon execution/i }));
    expect(onAbandon).toHaveBeenCalledWith(exec);
  });
});
