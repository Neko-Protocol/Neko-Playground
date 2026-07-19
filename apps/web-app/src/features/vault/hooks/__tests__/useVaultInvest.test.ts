// @vitest-environment jsdom
/**
 * Tests for useVaultInvest — the hook that triggers the vault "invest idle
 * funds" execution flow (issue #255).
 *
 * useVaultData (heavy stellar-sdk vault client) is mocked to a no-op refetch,
 * and `global.fetch` is stubbed so the test drives the hook's own control flow:
 * the initial invest-status GET, plus the POST-driven `triggerInvest` branches
 * (partial success, nothing-to-invest, error response, and thrown fetch). The
 * hook is wrapped in a real QueryClientProvider so `useQuery` behaves normally.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../useVaultData", () => ({
  useVaultData: () => ({ refetch: vi.fn() }),
}));

import { useVaultInvest } from "../useVaultInvest";

const investStatus = {
  idle: 1000,
  total: 5000,
  canInvest: true,
  cooldownRemaining: 0,
  allocations: [{ strategy: "s1", amount: 500 }],
};

/** Fresh QueryClient per render, retries off so failures settle immediately. */
function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
}

/** Builds a fetch mock: GET resolves the status, POST resolves `postResponse`. */
function mockFetch(postResponse: {
  ok: boolean;
  status: number;
  body: unknown;
}) {
  return vi.fn((_url: string, init?: { method?: string }) => {
    if (init?.method === "POST") {
      return Promise.resolve({
        ok: postResponse.ok,
        status: postResponse.status,
        json: async () => postResponse.body,
      } as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => investStatus,
    } as Response);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useVaultInvest – status query", () => {
  it("exposes the fetched invest status once the GET settles", async () => {
    vi.stubGlobal("fetch", mockFetch({ ok: true, status: 200, body: {} }));

    const { result } = renderHook(() => useVaultInvest(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.idleAmount).toBe(1000));
    expect(result.current.totalAmount).toBe(5000);
    expect(result.current.canInvest).toBe(true);
    expect(result.current.allocations).toEqual(investStatus.allocations);
  });
});

describe("useVaultInvest – triggerInvest happy path", () => {
  it("POSTs to /api/vault/invest and reports the success ratio", async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      body: {
        invested: true,
        results: [{ status: "SUCCESS" }, { status: "FAILED" }],
      },
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useVaultInvest(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerInvest();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/vault/invest", {
      method: "POST",
    });
    await waitFor(() =>
      expect(result.current.lastResult).toBe("Invested across 1/2 strategies")
    );
    expect(result.current.isInvesting).toBe(false);
  });
});

describe("useVaultInvest – triggerInvest non-happy branches", () => {
  it("reports the server message when nothing was invested", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: true,
        status: 200,
        body: { invested: false, message: "Nothing to invest" },
      })
    );

    const { result } = renderHook(() => useVaultInvest(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerInvest();
    });

    await waitFor(() =>
      expect(result.current.lastResult).toBe("Nothing to invest")
    );
  });

  it("surfaces the error field when the POST fails (non-207)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ok: false,
        status: 500,
        body: { error: "boom" },
      })
    );

    const { result } = renderHook(() => useVaultInvest(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerInvest();
    });

    await waitFor(() => expect(result.current.lastResult).toBe("Error: boom"));
  });

  it("captures the error message when fetch itself throws", async () => {
    const fetchMock = vi.fn((_url: string, init?: { method?: string }) => {
      if (init?.method === "POST") {
        return Promise.reject(new Error("network down"));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => investStatus,
      } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useVaultInvest(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.triggerInvest();
    });

    await waitFor(() => expect(result.current.lastResult).toBe("network down"));
    expect(result.current.isInvesting).toBe(false);
  });
});
