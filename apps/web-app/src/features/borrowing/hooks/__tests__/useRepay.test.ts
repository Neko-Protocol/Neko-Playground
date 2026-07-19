// @vitest-environment jsdom
/**
 * Tests for useRepay — the hook that assembles and submits the Soroban
 * repayment transaction (issue #255).
 *
 * The wallet, toast, RPC helpers and contract-error decoder are all mocked so
 * the test exercises the hook's own control flow: input validation, the
 * build → sign → send happy path, and error surfacing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { addNotification, signTransaction, walletState } = vi.hoisted(() => {
  const addNotification = vi.fn();
  const signTransaction = vi.fn();
  return {
    addNotification,
    signTransaction,
    walletState: {
      address: "GTEST_ADDRESS" as string | undefined,
      signTransaction,
      networkPassphrase: "Test SDF Network ; September 2015",
    },
  };
});

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({ addNotification }),
}));
vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => walletState,
}));
vi.mock("@/lib/helpers/stellar/lending", () => ({
  repayPool: vi.fn(),
}));
vi.mock("@/lib/helpers/stellar/transaction", () => ({
  signAndSendTransaction: vi.fn(),
}));
vi.mock("@/lib/helpers/stellar/contractErrors", () => ({
  extractContractErrorOrNull: vi.fn(),
}));

import { useRepay } from "../useRepay";
import { repayPool } from "@/lib/helpers/stellar/lending";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";

const repayPoolMock = vi.mocked(repayPool);
const signAndSendMock = vi.mocked(signAndSendTransaction);
const extractErrorMock = vi.mocked(extractContractErrorOrNull);

const validParams = {
  assetCode: "USDC",
  dTokens: 1_000_0000n,
  contractId: "CCONTRACT_ID",
};

beforeEach(() => {
  vi.clearAllMocks();
  walletState.address = "GTEST_ADDRESS";
  repayPoolMock.mockResolvedValue("REPAY_XDR");
  signAndSendMock.mockResolvedValue({ hash: "HASH", status: "SUCCESS" });
});

describe("useRepay – guards", () => {
  it("errors and does not build a tx when the wallet is disconnected", async () => {
    walletState.address = undefined;
    const { result } = renderHook(() => useRepay());

    await act(async () => {
      await result.current.handleRepay(validParams);
    });

    expect(repayPoolMock).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "Please connect your wallet first",
      })
    );
  });

  it("errors when there is no debt to repay (dTokens <= 0)", async () => {
    const { result } = renderHook(() => useRepay());

    await act(async () => {
      await result.current.handleRepay({ ...validParams, dTokens: 0n });
    });

    expect(repayPoolMock).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({ description: "No debt to repay" })
    );
  });

  it("exposes wallet-connected state", () => {
    const { result } = renderHook(() => useRepay());
    expect(result.current.isWalletConnected).toBe(true);
  });
});

describe("useRepay – happy path", () => {
  it("builds the repay XDR with the raw dToken amount and submits it", async () => {
    const { result } = renderHook(() => useRepay());

    let outcome;
    await act(async () => {
      outcome = await result.current.handleRepay(validParams);
    });

    expect(repayPoolMock).toHaveBeenCalledWith(
      "USDC",
      1_000_0000n,
      "GTEST_ADDRESS",
      "CCONTRACT_ID"
    );
    expect(signAndSendMock).toHaveBeenCalledWith(
      "REPAY_XDR",
      signTransaction,
      expect.objectContaining({
        address: "GTEST_ADDRESS",
        waitForPending: true,
      })
    );
    expect(outcome).toEqual({ success: true });
    expect(addNotification).toHaveBeenCalledWith(
      "Repayment Successful",
      "success",
      expect.anything()
    );
  });

  it("toggles isLoading back to false after completion", async () => {
    const { result } = renderHook(() => useRepay());
    await act(async () => {
      await result.current.handleRepay(validParams);
    });
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useRepay – error handling", () => {
  it("surfaces a decoded contract error when the submission fails", async () => {
    signAndSendMock.mockRejectedValue(new Error("boom"));
    extractErrorMock.mockReturnValue("Pool is frozen");

    const { result } = renderHook(() => useRepay());

    let outcome;
    await act(async () => {
      outcome = await result.current.handleRepay(validParams);
    });

    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({ description: "Pool is frozen" })
    );
    expect(outcome).toMatchObject({ success: false });
  });

  it("falls back to a generic message when the error is not decodable", async () => {
    signAndSendMock.mockRejectedValue(new Error("boom"));
    extractErrorMock.mockReturnValue(null);

    const { result } = renderHook(() => useRepay());

    await act(async () => {
      await result.current.handleRepay(validParams);
    });

    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "An unexpected error occurred. Please try again.",
      })
    );
  });
});
