// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ExecutionProgress } from "../components/ExecutionUI";
import type { ExecutionRecord, Strategy } from "@/lib/strategy/types";

afterEach(cleanup);

const strategy: Strategy = {
  id: "s1",
  version: 1,
  name: "Test",
  isTemplate: false,
  createdAt: 0,
  updatedAt: 0,
  steps: [
    {
      id: "a",
      type: "swap",
      protocol: "soroswap",
      label: "Swap Step",
      params: {},
      dependsOn: [],
    },
    {
      id: "b",
      type: "vaultDeposit",
      protocol: "defindex",
      label: "Deposit Step",
      dependsOn: ["a"],
      params: {},
    },
  ],
};

function execution(steps: ExecutionRecord["steps"]): ExecutionRecord {
  return {
    id: "e1",
    strategyId: "s1",
    strategySnapshot: strategy,
    status: "in_progress",
    startedAt: 0,
    updatedAt: 0,
    projectedOutcome: {},
    steps,
  };
}

describe("ExecutionProgress", () => {
  it("renders every strategy step, defaulting to pending when no record exists yet", () => {
    render(<ExecutionProgress strategy={strategy} execution={execution([])} />);
    expect(screen.getByText("Swap Step")).toBeTruthy();
    expect(screen.getByText("Deposit Step")).toBeTruthy();
    expect(screen.getAllByText("Pending")).toHaveLength(2);
  });

  it("reflects each step's actual recorded status and shows a truncated tx hash when recorded", () => {
    render(
      <ExecutionProgress
        strategy={strategy}
        execution={execution([
          { stepId: "a", status: "completed", txHash: "abcdef1234567890" },
          { stepId: "b", status: "confirming" },
        ])}
      />
    );
    expect(screen.getByText(/^Completed/)).toBeTruthy();
    expect(screen.getByText("Confirming on-chain")).toBeTruthy();
    expect(screen.getByText(/abcdef12…/)).toBeTruthy();
  });

  it("renders as an ordered list for assistive tech", () => {
    render(<ExecutionProgress strategy={strategy} execution={execution([])} />);
    expect(
      screen.getByRole("list", { name: /execution progress/i })
    ).toBeTruthy();
  });
});
