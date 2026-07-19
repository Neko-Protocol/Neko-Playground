// @vitest-environment jsdom
/**
 * Tests for useBorrowExecution — the hook that assembles and submits the
 * two-step Soroban borrow flow (add collateral, then borrow) (issue #255).
 *
 * The wallet, toast, RPC helpers, token registry and contract-error decoder
 * are all mocked so the test exercises the hook's own control flow: input and
 * guard validation, the two-step build → sign → send happy path (which signs
 * and sends twice), and error surfacing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { addNotification, signTransaction, walletState, availableTokens } =
  vi.hoisted(() => {
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
      availableTokens: {
        current: {
          XLM: { contract: "CXLM_CONTRACT", decimals: 7 },
        } as Record<string, { contract: string; decimals: number }>,
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
  addCollateral: vi.fn(),
  borrowFromPool: vi.fn(),
}));
vi.mock("@/lib/helpers/stellar/transaction", () => ({
  signAndSendTransaction: vi.fn(),
}));
vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getAvailableTokens: () => availableTokens.current,
}));
vi.mock("@/lib/helpers/stellar/contractErrors", () => ({
  extractContractErrorOrNull: vi.fn(),
}));

import { useBorrowExecution } from "../useBorrowExecution";
import { addCollateral, borrowFromPool } from "@/lib/helpers/stellar/lending";
import { signAndSendTransaction } from "@/lib/helpers/stellar/transaction";
import { extractContractErrorOrNull } from "@/lib/helpers/stellar/contractErrors";
import type { BorrowExecutionParams } from "../types/borrowing";

const addCollateralMock = vi.mocked(addCollateral);
const borrowFromPoolMock = vi.mocked(borrowFromPool);
const signAndSendMock = vi.mocked(signAndSendTransaction);
const extractErrorMock = vi.mocked(extractContractErrorOrNull);

const validParams: BorrowExecutionParams = {
  collateralTokenCode: "XLM",
  assetCode: "USDC",
  collateralAmount: "100",
  borrowAmount: "50",
  contractId: "CCONTRACT_ID",
};

beforeEach(() => {
  vi.clearAllMocks();
  walletState.address = "GTEST_ADDRESS";
  availableTokens.current = {
    XLM: { contract: "CXLM_CONTRACT", decimals: 7 },
  };
  addCollateralMock.mockResolvedValue("ADD_COLLATERAL_XDR");
  borrowFromPoolMock.mockResolvedValue("BORROW_XDR");
  signAndSendMock.mockResolvedValue({ hash: "HASH", status: "SUCCESS" });
});

describe("useBorrowExecution – guards", () => {
  it("errors and builds nothing when the wallet is disconnected", async () => {
    walletState.address = undefined;
    const { result } = renderHook(() => useBorrowExecution());

    await act(async () => {
      await result.current.handleBorrow(validParams);
    });

    expect(addCollateralMock).not.toHaveBeenCalled();
    expect(borrowFromPoolMock).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "Please connect your wallet first",
      })
    );
  });

  it("errors when the collateral amount is zero or invalid", async () => {
    const { result } = renderHook(() => useBorrowExecution());

    await act(async () => {
      await result.current.handleBorrow({
        ...validParams,
        collateralAmount: "0",
      });
    });

    expect(addCollateralMock).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "Please enter valid collateral and borrow amounts",
      })
    );
  });

  it("errors when the borrow amount is not a finite positive number", async () => {
    const { result } = renderHook(() => useBorrowExecution());

    await act(async () => {
      await result.current.handleBorrow({
        ...validParams,
        borrowAmount: "abc",
      });
    });

    expect(addCollateralMock).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "Please enter valid collateral and borrow amounts",
      })
    );
  });

  it("errors when the collateral token is not in the registry", async () => {
    availableTokens.current = {};
    const { result } = renderHook(() => useBorrowExecution());

    await act(async () => {
      await result.current.handleBorrow(validParams);
    });

    expect(addCollateralMock).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({
        description: "Collateral token XLM not found",
      })
    );
  });

  it("exposes wallet-connected state", () => {
    const { result } = renderHook(() => useBorrowExecution());
    expect(result.current.isWalletConnected).toBe(true);
  });
});

describe("useBorrowExecution – happy path", () => {
  it("builds both XDRs with the right args and signs/sends twice", async () => {
    const { result } = renderHook(() => useBorrowExecution());

    let outcome;
    await act(async () => {
      outcome = await result.current.handleBorrow(validParams);
    });

    expect(addCollateralMock).toHaveBeenCalledWith(
      "CXLM_CONTRACT",
      "100",
      7,
      "GTEST_ADDRESS",
      "CCONTRACT_ID"
    );
    expect(borrowFromPoolMock).toHaveBeenCalledWith(
      "USDC",
      "50",
      7,
      "GTEST_ADDRESS",
      "CCONTRACT_ID"
    );

    expect(signAndSendMock).toHaveBeenCalledTimes(2);
    expect(signAndSendMock).toHaveBeenNthCalledWith(
      1,
      "ADD_COLLATERAL_XDR",
      signTransaction,
      expect.objectContaining({
        address: "GTEST_ADDRESS",
        waitForPending: true,
      })
    );
    expect(signAndSendMock).toHaveBeenNthCalledWith(
      2,
      "BORROW_XDR",
      signTransaction,
      expect.objectContaining({
        address: "GTEST_ADDRESS",
        waitForPending: true,
      })
    );

    expect(outcome).toEqual({ success: true });
    expect(addNotification).toHaveBeenCalledWith(
      "Success",
      "success",
      expect.objectContaining({ description: "Successfully borrowed 50 USDC" })
    );
  });

  it("honors explicit collateral and borrow decimals from params", async () => {
    const { result } = renderHook(() => useBorrowExecution());

    await act(async () => {
      await result.current.handleBorrow({
        ...validParams,
        collateralDecimals: 6,
        borrowDecimals: 18,
      });
    });

    expect(addCollateralMock).toHaveBeenCalledWith(
      "CXLM_CONTRACT",
      "100",
      6,
      "GTEST_ADDRESS",
      "CCONTRACT_ID"
    );
    expect(borrowFromPoolMock).toHaveBeenCalledWith(
      "USDC",
      "50",
      18,
      "GTEST_ADDRESS",
      "CCONTRACT_ID"
    );
  });

  it("toggles isLoading back to false after completion", async () => {
    const { result } = renderHook(() => useBorrowExecution());
    await act(async () => {
      await result.current.handleBorrow(validParams);
    });
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useBorrowExecution – error handling", () => {
  it("does not borrow when the collateral submission fails", async () => {
    signAndSendMock.mockRejectedValueOnce(new Error("boom"));
    extractErrorMock.mockReturnValue("Insufficient balance");

    const { result } = renderHook(() => useBorrowExecution());

    let outcome;
    await act(async () => {
      outcome = await result.current.handleBorrow(validParams);
    });

    expect(borrowFromPoolMock).not.toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Something went wrong",
      "error",
      expect.objectContaining({ description: "Insufficient balance" })
    );
    expect(outcome).toMatchObject({ success: false });
  });

  it("surfaces a decoded contract error when a submission fails", async () => {
    signAndSendMock.mockRejectedValue(new Error("boom"));
    extractErrorMock.mockReturnValue("Pool is frozen");

    const { result } = renderHook(() => useBorrowExecution());

    let outcome;
    await act(async () => {
      outcome = await result.current.handleBorrow(validParams);
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

    const { result } = renderHook(() => useBorrowExecution());

    await act(async () => {
      await result.current.handleBorrow(validParams);
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
