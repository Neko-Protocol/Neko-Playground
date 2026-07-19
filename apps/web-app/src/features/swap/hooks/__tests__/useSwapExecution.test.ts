// @vitest-environment jsdom
/**
 * Tests for useSwapExecution — the hook that turns a swap intent into a signed,
 * submitted Soroswap transaction (issue #255).
 *
 * The Soroswap quote/build/send helpers and the wallet (signTransaction +
 * networkPassphrase) are mocked so the test exercises the hook's own control
 * flow: input/guard validation, the quote → build → sign → send happy path
 * (including the exact QuoteRequest shape), and error surfacing — notably the
 * USER_REJECTED mapping. Note the hook reads networkPassphrase from the wallet,
 * not from the params.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const { signTransaction, walletState } = vi.hoisted(() => {
  const signTransaction = vi.fn();
  return {
    signTransaction,
    walletState: {
      signTransaction,
      networkPassphrase: "Test SDF Network ; September 2015" as
        | string
        | undefined,
    },
  };
});

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => walletState,
}));
vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getQuote: vi.fn(),
  buildTransaction: vi.fn(),
  sendTransaction: vi.fn(),
}));

import { useSwapExecution } from "../useSwapExecution";
import {
  getQuote,
  buildTransaction,
  sendTransaction,
} from "@/lib/helpers/stellar/soroswap";

const getQuoteMock = vi.mocked(getQuote);
const buildTransactionMock = vi.mocked(buildTransaction);
const sendTransactionMock = vi.mocked(sendTransaction);

const validParams = {
  amountIn: "100",
  tokenIn: "CTOKEN_IN",
  tokenOut: "CTOKEN_OUT",
  address: "GTEST_ADDRESS",
  networkPassphrase: "unused-passphrase-from-params",
};

beforeEach(() => {
  vi.clearAllMocks();
  walletState.networkPassphrase = "Test SDF Network ; September 2015";
  getQuoteMock.mockResolvedValue({ some: "quote" } as never);
  buildTransactionMock.mockResolvedValue({ xdr: "BUILT_XDR" } as never);
  signTransaction.mockResolvedValue({ signedTxXdr: "SIGNED_XDR" });
  sendTransactionMock.mockResolvedValue({ txHash: "TX_HASH" } as never);
});

describe("useSwapExecution – guards", () => {
  it("throws on a missing / non-positive amount", async () => {
    const { result } = renderHook(() => useSwapExecution());

    await expect(
      result.current.executeSwap({ ...validParams, amountIn: "0" })
    ).rejects.toThrow("Invalid amount or address");
    expect(getQuoteMock).not.toHaveBeenCalled();
  });

  it("throws when the address is missing", async () => {
    const { result } = renderHook(() => useSwapExecution());

    await expect(
      result.current.executeSwap({ ...validParams, address: undefined })
    ).rejects.toThrow("Invalid amount or address");
    expect(getQuoteMock).not.toHaveBeenCalled();
  });

  it("throws when the wallet has no networkPassphrase", async () => {
    walletState.networkPassphrase = undefined;
    const { result } = renderHook(() => useSwapExecution());

    await expect(result.current.executeSwap(validParams)).rejects.toThrow(
      "Wallet not connected"
    );
    expect(getQuoteMock).not.toHaveBeenCalled();
  });
});

describe("useSwapExecution – happy path", () => {
  it("requests a quote with the expected EXACT_IN QuoteRequest", async () => {
    const { result } = renderHook(() => useSwapExecution());

    await result.current.executeSwap(validParams);

    expect(getQuoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        assetIn: "CTOKEN_IN",
        assetOut: "CTOKEN_OUT",
        amount: "100",
        tradeType: "EXACT_IN",
        protocols: ["soroswap", "phoenix", "aqua"],
        slippageBps: 500,
        maxHops: 3,
      })
    );
  });

  it("builds, signs and sends, resolving to the tx hash as orderId", async () => {
    const { result } = renderHook(() => useSwapExecution());

    const outcome = await result.current.executeSwap(validParams);

    expect(buildTransactionMock).toHaveBeenCalledWith({
      quote: { some: "quote" },
      from: "GTEST_ADDRESS",
      to: "GTEST_ADDRESS",
    });
    expect(signTransaction).toHaveBeenCalledWith(
      "BUILT_XDR",
      expect.objectContaining({
        networkPassphrase: "Test SDF Network ; September 2015",
        address: "GTEST_ADDRESS",
      })
    );
    expect(sendTransactionMock).toHaveBeenCalledWith(
      expect.objectContaining({ xdr: "SIGNED_XDR", launchtube: false })
    );
    expect(outcome).toEqual({ orderId: "TX_HASH", txHash: "TX_HASH" });
  });
});

describe("useSwapExecution – error handling", () => {
  it("throws when no quote (no liquidity) is returned", async () => {
    getQuoteMock.mockResolvedValue(null as never);
    const { result } = renderHook(() => useSwapExecution());

    await expect(result.current.executeSwap(validParams)).rejects.toThrow(
      "No liquidity found"
    );
    expect(buildTransactionMock).not.toHaveBeenCalled();
  });

  it("throws Transaction failed when send returns no txHash", async () => {
    sendTransactionMock.mockResolvedValue({} as never);
    const { result } = renderHook(() => useSwapExecution());

    await expect(result.current.executeSwap(validParams)).rejects.toThrow(
      "Transaction failed"
    );
  });

  it("maps a rejected-signature error to USER_REJECTED", async () => {
    signTransaction.mockRejectedValue(new Error("User rejected the request"));
    const { result } = renderHook(() => useSwapExecution());

    await expect(result.current.executeSwap(validParams)).rejects.toThrow(
      "USER_REJECTED"
    );
    expect(sendTransactionMock).not.toHaveBeenCalled();
  });

  it("maps a denied-signature error to USER_REJECTED", async () => {
    signTransaction.mockRejectedValue(new Error("Request denied by user"));
    const { result } = renderHook(() => useSwapExecution());

    await expect(result.current.executeSwap(validParams)).rejects.toThrow(
      "USER_REJECTED"
    );
  });

  it("re-throws non-rejection signing errors unchanged", async () => {
    signTransaction.mockRejectedValue(new Error("network blip"));
    const { result } = renderHook(() => useSwapExecution());

    await expect(result.current.executeSwap(validParams)).rejects.toThrow(
      "network blip"
    );
    expect(sendTransactionMock).not.toHaveBeenCalled();
  });
});
