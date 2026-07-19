// @vitest-environment jsdom
/**
 * Tests for useLend — the hook that drives lending-pool deposits and
 * withdrawals (issue #255).
 *
 * The composed react-query hooks (useLendingPools, usePools, usePoolAction),
 * the wallet/toast context, and all Soroban helpers (deposit/withdraw, token
 * lookup, RPC send, tx confirmation) are mocked so the test exercises only the
 * hook's own control flow: the derived `pools` memo, the handleConfirm guards,
 * and the three fund-moving execution paths (aggregated deposit, Neko deposit,
 * Neko withdraw).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PoolData } from "../types/lending";

const {
  addNotification,
  signTransaction,
  walletState,
  executePoolActionMock,
  refetchPoolsMock,
  lendingPoolsFixture,
} = vi.hoisted(() => {
  const addNotification = vi.fn();
  const signTransaction = vi.fn();
  return {
    addNotification,
    signTransaction,
    executePoolActionMock: vi.fn(),
    refetchPoolsMock: vi.fn(),
    lendingPoolsFixture: [
      {
        asset: "CASSET",
        assetCode: "USDC",
        poolBalance: "1500",
        poolBalanceUSD: "Calculating...",
        interestRate: 5.5,
        bTokenRate: "1.0",
        isActive: true,
        contractId: "CPOOL",
      },
    ],
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
vi.mock("../useLendingPools", () => ({
  useLendingPools: () => ({
    data: lendingPoolsFixture,
    isLoading: false,
    error: null,
    refetch: refetchPoolsMock,
  }),
}));
vi.mock("@/lib/orchestrator", () => ({
  usePools: () => ({ data: [], isLoading: false, error: null }),
  usePoolAction: () => ({ mutateAsync: executePoolActionMock }),
}));
vi.mock("@/lib/helpers/stellar/lending", () => ({
  depositToPool: vi.fn(),
  withdrawFromPool: vi.fn(),
  getBTokenBalance: vi.fn(),
}));
vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  getAvailableTokens: () => ({ USDC: { contract: "CUSDC", decimals: 7 } }),
}));
vi.mock("@/lib/helpers/stellar/waitForTransaction", () => ({
  waitForTransaction: vi.fn(),
}));
vi.mock("@stellar/stellar-sdk", () => ({
  Networks: { TESTNET: "Test SDF Network ; September 2015" },
  TransactionBuilder: { fromXDR: vi.fn(() => ({})) },
  rpc: {
    Server: class {
      sendTransaction = vi.fn().mockResolvedValue({ hash: "HASH" });
    },
  },
}));

import { useLend } from "../useLend";
import {
  depositToPool,
  withdrawFromPool,
  getBTokenBalance,
} from "@/lib/helpers/stellar/lending";
import { waitForTransaction } from "@/lib/helpers/stellar/waitForTransaction";

const depositToPoolMock = vi.mocked(depositToPool);
const withdrawFromPoolMock = vi.mocked(withdrawFromPool);
const getBTokenBalanceMock = vi.mocked(getBTokenBalance);
const waitForTransactionMock = vi.mocked(waitForTransaction);

const nekoPool: PoolData = {
  id: "pool-0",
  name: "USDC Pool",
  token1: "USDC",
  token2: "",
  fee: "0%",
  roi: "5.50%",
  feeApy: "5.50%",
  liquidity: "$1.50k",
  isActive: true,
  assetCode: "USDC",
  asset: "CASSET",
  bTokenRate: "1.0",
  contractId: "CPOOL",
};

const aggregatedPool: PoolData = {
  ...nekoPool,
  id: "agg-orch:1",
  isAggregated: true,
  orchestratorId: "orch:1",
  bTokenRate: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
  walletState.address = "GTEST_ADDRESS";
  depositToPoolMock.mockResolvedValue("DEPOSIT_XDR");
  withdrawFromPoolMock.mockResolvedValue("WITHDRAW_XDR");
  getBTokenBalanceMock.mockResolvedValue("0");
  waitForTransactionMock.mockResolvedValue(undefined as never);
  signTransaction.mockResolvedValue({ signedTxXdr: "SIGNED_XDR" });
  executePoolActionMock.mockResolvedValue(undefined);
  refetchPoolsMock.mockResolvedValue(undefined);
});

describe("useLend – derived pools memo", () => {
  it("maps a lending pool into the PoolData display shape", () => {
    const { result } = renderHook(() => useLend());
    expect(result.current.pools).toHaveLength(1);
    expect(result.current.pools[0]).toMatchObject({
      id: "pool-0",
      name: "USDC Pool",
      token1: "USDC",
      roi: "5.50%",
      feeApy: "5.50%",
      liquidity: "$1.50k",
      assetCode: "USDC",
      contractId: "CPOOL",
      bTokenRate: "1.0",
    });
  });

  it("exposes wallet presence via hasWallet", () => {
    const { result } = renderHook(() => useLend());
    expect(result.current.hasWallet).toBe(true);
  });
});

describe("useLend – handleConfirm guards", () => {
  it("does nothing when no pool is selected", async () => {
    const { result } = renderHook(() => useLend());
    await act(async () => {
      await result.current.handleConfirm("10");
    });
    expect(depositToPoolMock).not.toHaveBeenCalled();
    expect(executePoolActionMock).not.toHaveBeenCalled();
  });

  it("does nothing when the wallet is disconnected", async () => {
    walletState.address = undefined;
    const { result } = renderHook(() => useLend());
    act(() => {
      result.current.openModal(nekoPool, true);
    });
    await act(async () => {
      await result.current.handleConfirm("10");
    });
    expect(depositToPoolMock).not.toHaveBeenCalled();
  });

  it("does nothing when the amount is zero or negative", async () => {
    const { result } = renderHook(() => useLend());
    act(() => {
      result.current.openModal(nekoPool, true);
    });
    await act(async () => {
      await result.current.handleConfirm("0");
    });
    expect(depositToPoolMock).not.toHaveBeenCalled();
    expect(executePoolActionMock).not.toHaveBeenCalled();
  });
});

describe("useLend – aggregated pool deposit path", () => {
  it("executes the orchestrator action with the raw bigint amount", async () => {
    const { result } = renderHook(() => useLend());
    act(() => {
      result.current.openModal(aggregatedPool, true);
    });

    await act(async () => {
      await result.current.handleConfirm("10");
    });

    expect(executePoolActionMock).toHaveBeenCalledWith({
      poolId: "orch:1",
      action: "deposit",
      amount: BigInt(Math.floor(parseFloat("10") * 1e7)),
    });
    expect(depositToPoolMock).not.toHaveBeenCalled();
    expect(refetchPoolsMock).toHaveBeenCalled();
    expect(addNotification).toHaveBeenCalledWith(
      "Success",
      "success",
      expect.objectContaining({
        description: "Successfully deposited 10 USDC",
      })
    );
  });
});

describe("useLend – Neko deposit path", () => {
  it("builds, signs, submits and confirms the deposit transaction", async () => {
    const { result } = renderHook(() => useLend());
    act(() => {
      result.current.openModal(nekoPool, true);
    });

    await act(async () => {
      await result.current.handleConfirm("10");
    });

    expect(depositToPoolMock).toHaveBeenCalledWith(
      "USDC",
      "10",
      7,
      "GTEST_ADDRESS",
      "CPOOL"
    );
    expect(signTransaction).toHaveBeenCalledWith(
      "DEPOSIT_XDR",
      expect.objectContaining({ address: "GTEST_ADDRESS" })
    );
    expect(waitForTransactionMock).toHaveBeenCalledWith(
      "HASH",
      expect.anything()
    );
    expect(addNotification).toHaveBeenCalledWith(
      "Success",
      "success",
      expect.objectContaining({
        description: "Successfully deposited 10 USDC",
      })
    );
  });
});

describe("useLend – Neko withdraw path", () => {
  it("builds and submits the withdraw transaction", async () => {
    const { result } = renderHook(() => useLend());
    act(() => {
      result.current.openModal(nekoPool, false);
    });

    await act(async () => {
      await result.current.handleConfirm("10");
    });

    expect(withdrawFromPoolMock).toHaveBeenCalledWith(
      "USDC",
      expect.any(String),
      7,
      "GTEST_ADDRESS",
      "CPOOL"
    );
    expect(waitForTransactionMock).toHaveBeenCalledWith(
      "HASH",
      expect.anything()
    );
    expect(addNotification).toHaveBeenCalledWith(
      "Success",
      "success",
      expect.objectContaining({
        description: "Successfully withdrew 10 USDC",
      })
    );
  });

  it("re-throws when bTokenRate is missing on a withdraw", async () => {
    const poolWithoutRate: PoolData = { ...nekoPool, bTokenRate: undefined };
    const { result } = renderHook(() => useLend());
    act(() => {
      result.current.openModal(poolWithoutRate, false);
    });

    await expect(
      act(async () => {
        await result.current.handleConfirm("10");
      })
    ).rejects.toThrow("Unable to calculate bTokens. Please try again.");
    expect(withdrawFromPoolMock).not.toHaveBeenCalled();
  });
});

describe("useLend – error propagation", () => {
  it("re-throws when the deposit helper rejects", async () => {
    depositToPoolMock.mockRejectedValue(new Error("deposit boom"));
    const { result } = renderHook(() => useLend());
    act(() => {
      result.current.openModal(nekoPool, true);
    });

    await expect(
      act(async () => {
        await result.current.handleConfirm("10");
      })
    ).rejects.toThrow("deposit boom");
  });
});
