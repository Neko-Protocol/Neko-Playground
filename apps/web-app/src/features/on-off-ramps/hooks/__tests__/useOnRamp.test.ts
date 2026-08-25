// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOnRamp } from "../useOnRamp";

const getOnRampTransactionMock = vi.hoisted(() => vi.fn());
const createOnRampMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/rampApi", () => ({
  createOnRamp: createOnRampMock,
  getOnRampTransaction: getOnRampTransactionMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function TestWrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  }
  TestWrapper.displayName = "TestWrapper";
  return TestWrapper;
}

describe("useOnRamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createOnRampMock.mockReset();
    getOnRampTransactionMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets timed-out outcome when the poll deadline elapses", async () => {
    createOnRampMock.mockResolvedValue({
      id: "tx-1",
      status: "pending",
    });
    getOnRampTransactionMock.mockResolvedValue({
      id: "tx-1",
      status: "pending",
    });

    const { result } = renderHook(() => useOnRamp("etherfuse"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startOnRamp({
        customerId: "cust-1",
        quoteId: "quote-1",
        stellarAddress: "GTEST",
        fromCurrency: "MXN",
        toCurrency: "CETES",
        amount: "100",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1_000 + 100);
    });

    expect(result.current.pollOutcome).toBe("timed-out");
    expect(result.current.isPolling).toBe(false);
  });

  it("retry resumes polling for the same transaction id", async () => {
    createOnRampMock.mockResolvedValue({
      id: "tx-1",
      status: "pending",
    });
    getOnRampTransactionMock.mockResolvedValue({
      id: "tx-1",
      status: "pending",
    });

    const { result } = renderHook(() => useOnRamp("etherfuse"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.startOnRamp({
        customerId: "cust-1",
        quoteId: "quote-1",
        stellarAddress: "GTEST",
        fromCurrency: "MXN",
        toCurrency: "CETES",
        amount: "100",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1_000 + 100);
    });

    getOnRampTransactionMock.mockResolvedValue({
      id: "tx-1",
      status: "completed",
    });

    await act(async () => {
      result.current.retryPoll();
    });
    expect(result.current.pollOutcome).toBe("pending");

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.pollOutcome).toBe("terminal");
    expect(getOnRampTransactionMock).toHaveBeenCalledWith(
      "etherfuse",
      "tx-1",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});
