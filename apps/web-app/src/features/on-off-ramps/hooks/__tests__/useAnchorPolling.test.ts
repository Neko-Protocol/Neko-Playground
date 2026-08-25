// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAnchorPolling } from "../useAnchorPolling";
import { RampApiError } from "../../utils/rampApi";

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

describe("useAnchorPolling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reaches terminal outcome when isTerminal returns true", async () => {
    const queryFn = vi.fn().mockResolvedValue({ status: "completed" });

    const { result } = renderHook(
      () =>
        useAnchorPolling({
          enabled: true,
          queryFn,
          isTerminal: (data) => data.status === "completed",
          intervalMs: 100,
          deadlineMs: 5_000,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.outcome).toBe("terminal");
    expect(queryFn).toHaveBeenCalled();
  });

  it("reaches timed-out when the deadline elapses", async () => {
    const queryFn = vi.fn().mockResolvedValue({ status: "pending" });

    const { result } = renderHook(
      () =>
        useAnchorPolling({
          enabled: true,
          queryFn,
          isTerminal: (data) => data.status === "completed",
          intervalMs: 100,
          deadlineMs: 250,
          unreachableAfter: 99,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.outcome).toBe("timed-out");
  });

  it("widens the interval after consecutive failures", async () => {
    const queryFn = vi
      .fn()
      .mockRejectedValue(new RampApiError("fail", "UNREACHABLE", 503));

    renderHook(
      () =>
        useAnchorPolling({
          enabled: true,
          queryFn,
          isTerminal: () => false,
          intervalMs: 100,
          deadlineMs: 10_000,
          unreachableAfter: 5,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not update outcome after unmount abort", async () => {
    let resolveFetch!: () => void;
    const queryFn = vi.fn(
      () =>
        new Promise<{ status: string }>((resolve) => {
          resolveFetch = () => resolve({ status: "completed" });
        })
    );

    const { result, unmount } = renderHook(
      () =>
        useAnchorPolling({
          enabled: true,
          queryFn,
          isTerminal: (data) => data.status === "completed",
          intervalMs: 100,
          deadlineMs: 5_000,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    unmount();

    await act(async () => {
      resolveFetch();
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(result.current.outcome).toBe("pending");
  });

  it("retry keeps the same queryFn identity window", async () => {
    const queryFn = vi.fn().mockResolvedValue({ status: "pending" });

    const { result } = renderHook(
      () =>
        useAnchorPolling({
          enabled: true,
          queryFn,
          isTerminal: (data) => data.status === "completed",
          intervalMs: 50,
          deadlineMs: 120,
          unreachableAfter: 99,
        }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current.outcome).toBe("timed-out");

    queryFn.mockResolvedValue({ status: "completed" });

    await act(async () => {
      result.current.retry();
    });
    expect(result.current.outcome).toBe("pending");

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.outcome).toBe("terminal");
    expect(queryFn.mock.calls.length).toBeGreaterThan(1);
  });
});
