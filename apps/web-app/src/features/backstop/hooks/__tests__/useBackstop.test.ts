// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  addNotification,
  signTransaction,
  executeTransactionMock,
  depositToBackstopMock,
  initiateBackstopWithdrawalMock,
  withdrawFromBackstopMock,
  getBackstopTokenMock,
  getBackstopDepositMock,
  getTokenBalanceMock,
  walletState,
} = vi.hoisted(() => ({
  addNotification: vi.fn(),
  signTransaction: vi.fn(),
  executeTransactionMock: vi.fn(),
  depositToBackstopMock: vi.fn(),
  initiateBackstopWithdrawalMock: vi.fn(),
  withdrawFromBackstopMock: vi.fn(),
  getBackstopTokenMock: vi.fn(),
  getBackstopDepositMock: vi.fn(),
  getTokenBalanceMock: vi.fn(),
  walletState: {
    address: "GTEST" as string | undefined,
    signTransaction: vi.fn(),
    networkPassphrase: "Test SDF Network ; September 2015",
  },
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ addNotification }),
}));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => walletState,
}));
vi.mock("@/lib/helpers/stellar/lending", () => ({
  depositToBackstop: depositToBackstopMock,
  initiateBackstopWithdrawal: initiateBackstopWithdrawalMock,
  withdrawFromBackstop: withdrawFromBackstopMock,
  getBackstopToken: getBackstopTokenMock,
  getBackstopDeposit: getBackstopDepositMock,
  getTokenBalance: getTokenBalanceMock,
}));
vi.mock("@/lib/helpers/stellar/executeTransaction", () => ({
  executeTransaction: executeTransactionMock,
}));
vi.mock("@/lib/helpers/tokenUtils", () => ({
  fromSmallestUnit: (raw: string, decimals: number) => {
    const value = BigInt(raw);
    const scale = 10 ** decimals;
    return (Number(value) / scale).toString();
  },
}));

let mockCountdownExpired = false;
vi.mock("@/hooks/useCountdown", () => ({
  useCountdown: () => ({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: mockCountdownExpired ? 0 : 30,
    expired: mockCountdownExpired,
  }),
}));

import { useBackstop } from "../useBackstop";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  mockCountdownExpired = false;
  walletState.address = "GTEST";
  walletState.signTransaction = signTransaction;
  getBackstopTokenMock.mockResolvedValue("CTOKEN");
  getTokenBalanceMock.mockResolvedValue(100_0000000n);
  getBackstopDepositMock.mockResolvedValue({
    amount: 50_0000000n,
    activeAmount: 50_0000000n,
    queuedAmount: 0n,
    inWithdrawalQueue: false,
    queuedAt: null,
  });
  depositToBackstopMock.mockResolvedValue("DEPOSIT_XDR");
  initiateBackstopWithdrawalMock.mockResolvedValue("QUEUE_XDR");
  withdrawFromBackstopMock.mockResolvedValue("WITHDRAW_XDR");
  executeTransactionMock.mockResolvedValue({ status: "success", hash: "HASH" });
  signTransaction.mockResolvedValue({ signedTxXdr: "SIGNED" });
});

describe("useBackstop – amount validation", () => {
  it("shows an error and returns false for empty deposit amounts", async () => {
    const { result } = renderHook(() => useBackstop("CPOOL"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.walletBalance).toBe("100"));

    let ok = true;
    await act(async () => {
      ok = await result.current.handleDeposit("");
    });

    expect(ok).toBe(false);
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "Enter an amount greater than zero.",
      })
    );
    expect(executeTransactionMock).not.toHaveBeenCalled();
  });

  it("rejects deposit above wallet balance", async () => {
    const { result } = renderHook(() => useBackstop("CPOOL"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.walletBalance).toBe("100"));

    let ok = true;
    await act(async () => {
      ok = await result.current.handleDeposit("150");
    });

    expect(ok).toBe(false);
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "Amount exceeds wallet balance (100).",
      })
    );
  });
});

describe("useBackstop – reactive queue expiry", () => {
  it("marks queueExpired true when the queue date is already past", async () => {
    mockCountdownExpired = true;
    getBackstopDepositMock.mockResolvedValue({
      amount: 10_0000000n,
      activeAmount: 0n,
      queuedAmount: 10_0000000n,
      inWithdrawalQueue: true,
      queuedAt: Math.floor(Date.now() / 1000) - 60,
    });

    const { result } = renderHook(() => useBackstop("CPOOL"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.queueExpired).toBe(true));
  });

  it("flips queueExpired when the countdown elapses", async () => {
    const expiresAtSec = Math.floor((Date.now() + 3000) / 1000);
    getBackstopDepositMock.mockResolvedValue({
      amount: 10_0000000n,
      activeAmount: 0n,
      queuedAmount: 10_0000000n,
      inWithdrawalQueue: true,
      queuedAt: expiresAtSec,
    });

    const { result, rerender } = renderHook(() => useBackstop("CPOOL"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.inWithdrawalQueue).toBe(true));
    expect(result.current.queueExpired).toBe(false);

    mockCountdownExpired = true;
    await act(async () => {
      rerender();
    });

    expect(result.current.queueExpired).toBe(true);
  });
});

describe("useBackstop – contract errors", () => {
  it("maps queue-not-expired contract errors consistently", async () => {
    getBackstopDepositMock.mockResolvedValue({
      amount: 10_0000000n,
      activeAmount: 0n,
      queuedAmount: 10_0000000n,
      inWithdrawalQueue: true,
      queuedAt: Math.floor(Date.now() / 1000) - 60,
    });

    executeTransactionMock.mockResolvedValue({
      status: "contract_error",
      error: {
        kind: "withdrawal_queue_not_expired",
        message: "Withdrawal queue has not expired yet",
      },
    });

    const { result } = renderHook(() => useBackstop("CPOOL"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.inWithdrawalQueue).toBe(true));

    let ok = true;
    await act(async () => {
      ok = await result.current.handleWithdraw("10");
    });

    expect(ok).toBe(false);
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: expect.stringContaining("withdrawal queue period"),
      })
    );
  });
});
