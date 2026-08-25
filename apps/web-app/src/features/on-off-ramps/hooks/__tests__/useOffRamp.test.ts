// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useOffRamp } from "../useOffRamp";

const getOffRampTransactionMock = vi.hoisted(() => vi.fn());
const createOffRampMock = vi.hoisted(() => vi.fn());
const submitSignedXdrMock = vi.hoisted(() => vi.fn());
const signTransactionMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/rampApi", () => ({
  createOffRamp: createOffRampMock,
  getOffRampTransaction: getOffRampTransactionMock,
  submitSignedXdr: submitSignedXdrMock,
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

describe("useOffRamp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    createOffRampMock.mockReset();
    getOffRampTransactionMock.mockReset();
    submitSignedXdrMock.mockReset();
    signTransactionMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not mark done when completion polling times out", async () => {
    createOffRampMock.mockResolvedValue({
      id: "tx-1",
      status: "processing",
      signableTransaction: "xdr-1",
    });
    signTransactionMock.mockResolvedValue({ signedTxXdr: "signed-xdr" });
    submitSignedXdrMock.mockResolvedValue({ success: true, hash: "hash-1" });
    getOffRampTransactionMock.mockResolvedValue({
      id: "tx-1",
      status: "processing",
    });

    const { result } = renderHook(
      () => useOffRamp("etherfuse", signTransactionMock),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.startOffRamp({
        customerId: "cust-1",
        quoteId: "quote-1",
        stellarAddress: "GTEST",
        fromCurrency: "CETES",
        toCurrency: "MXN",
        amount: "100",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.phase).toBe("polling");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1_000 + 100);
    });

    expect(result.current.isDone).toBe(false);
    expect(result.current.pollOutcome).toBe("timed-out");
  });

  it("does not call signTransaction twice for the same transaction id", async () => {
    createOffRampMock.mockResolvedValue({
      id: "tx-1",
      status: "processing",
      signableTransaction: "xdr-1",
    });
    signTransactionMock.mockResolvedValue({ signedTxXdr: "signed-xdr" });
    submitSignedXdrMock.mockResolvedValue({ success: true, hash: "hash-1" });
    getOffRampTransactionMock.mockResolvedValue({
      id: "tx-1",
      status: "processing",
    });

    const { result, rerender } = renderHook(
      ({ signTransaction }) => useOffRamp("etherfuse", signTransaction),
      {
        initialProps: { signTransaction: signTransactionMock },
        wrapper: createWrapper(),
      }
    );

    await act(async () => {
      await result.current.startOffRamp({
        customerId: "cust-1",
        quoteId: "quote-1",
        stellarAddress: "GTEST",
        fromCurrency: "CETES",
        toCurrency: "MXN",
        amount: "100",
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(signTransactionMock).toHaveBeenCalledTimes(1);

    rerender({ signTransaction: signTransactionMock });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(signTransactionMock).toHaveBeenCalledTimes(1);
  });
});
