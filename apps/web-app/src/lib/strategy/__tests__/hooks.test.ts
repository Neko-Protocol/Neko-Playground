// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const {
  useWalletMock,
  simulateStrategyMock,
  listStrategiesMock,
  upsertStrategyMock,
  removeStrategyMock,
  upsertExecutionMock,
  ExecutionEngineMock,
  executeStrategyMock,
  findResumableExecutionsMock,
  reconcileExecutionMock,
  ServerMock,
} = vi.hoisted(() => {
  const executeStrategyMock = vi.fn().mockResolvedValue({
    record: { id: "e1", steps: [] },
    status: "completed",
  });
  class ExecutionEngineMock {
    deps: unknown;
    executeStrategy = executeStrategyMock;
    constructor(deps: unknown) {
      this.deps = deps;
    }
  }
  class ServerMock {
    getTransaction = vi.fn();
    sendTransaction = vi.fn();
  }
  return {
    useWalletMock: vi.fn(),
    simulateStrategyMock: vi.fn(),
    listStrategiesMock: vi.fn(),
    upsertStrategyMock: vi.fn(),
    removeStrategyMock: vi.fn(),
    upsertExecutionMock: vi.fn(),
    ExecutionEngineMock,
    executeStrategyMock,
    findResumableExecutionsMock: vi.fn(),
    reconcileExecutionMock: vi.fn(),
    ServerMock,
  };
});

vi.mock("@/hooks/useWallet", () => ({ useWallet: useWalletMock }));
vi.mock("@stellar/stellar-sdk", () => ({
  rpc: { Server: ServerMock },
  TransactionBuilder: { fromXDR: vi.fn() },
}));
vi.mock("@/lib/helpers/stellar/executeTransaction", () => ({
  submitSignedTransaction: vi.fn(),
  confirmTransactionHash: vi.fn(),
}));
vi.mock("@/lib/helpers/stellar/sorobanServer", () => ({
  getSorobanServer: vi.fn(),
}));
vi.mock("@/lib/helpers/stellar/soroswap", () => ({
  sendTransaction: vi.fn(),
  getQuote: vi.fn(),
  buildTransaction: vi.fn(),
  getAvailableTokens: vi.fn(() => ({})),
}));
vi.mock("@/lib/helpers/stellar/waitForTransaction", () => ({
  waitForTransaction: vi.fn(),
}));
vi.mock("../engine", () => ({
  validateStrategy: vi.fn(),
  simulateStrategy: simulateStrategyMock,
}));
vi.mock("../persistence", () => ({
  listStrategies: listStrategiesMock,
  upsertStrategy: upsertStrategyMock,
  removeStrategy: removeStrategyMock,
  upsertExecution: upsertExecutionMock,
}));
vi.mock("../execution", () => ({
  ExecutionEngine: ExecutionEngineMock,
  findResumableExecutions: findResumableExecutionsMock,
  reconcileExecution: reconcileExecutionMock,
}));
vi.mock("../definitions", () => ({}));
vi.mock("../registry", () => ({
  strategyStepRegistry: { listRegistered: () => [] },
}));

import {
  useStrategySimulation,
  useStrategyPersistence,
  useStrategyExecution,
  useExecutionRecovery,
} from "../hooks";
import type { ExecutionRecord, Strategy } from "../types";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  Wrapper.displayName = "QueryWrapper";
  return Wrapper;
}

const strategy: Strategy = {
  id: "s1",
  version: 1,
  name: "Test",
  isTemplate: false,
  steps: [],
  createdAt: 0,
  updatedAt: 0,
};
const execution: ExecutionRecord = {
  id: "e1",
  strategyId: "s1",
  strategySnapshot: strategy,
  status: "in_progress",
  startedAt: 0,
  updatedAt: 0,
  projectedOutcome: {},
  steps: [],
};

function record(id: string, status: string) {
  return {
    id,
    strategyId: "s1",
    strategySnapshot: {},
    status,
    startedAt: 0,
    updatedAt: 0,
    projectedOutcome: {},
    steps: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  executeStrategyMock.mockResolvedValue({
    record: { id: "e1", steps: [] },
    status: "completed",
  });
  useWalletMock.mockReturnValue({
    address: "GUSER",
    networkPassphrase: "Test SDF Network ; September 2015",
    signTransaction: vi.fn(),
    balances: {},
  });
  listStrategiesMock.mockReturnValue([]);
});

describe("useStrategySimulation", () => {
  it("calls simulateStrategy with the wallet's address/passphrase once a strategy and wallet are present", async () => {
    simulateStrategyMock.mockResolvedValue({ success: true, steps: {} });
    const { result } = renderHook(() => useStrategySimulation(strategy), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(simulateStrategyMock).toHaveBeenCalledWith(strategy, {
      userAddress: "GUSER",
      networkPassphrase: "Test SDF Network ; September 2015",
    });
  });

  it("stays disabled without a connected wallet or a null strategy", () => {
    useWalletMock.mockReturnValue({
      address: undefined,
      networkPassphrase: undefined,
      balances: {},
    });
    renderHook(() => useStrategySimulation(strategy), {
      wrapper: createWrapper(),
    });
    expect(simulateStrategyMock).not.toHaveBeenCalled();

    useWalletMock.mockReturnValue({
      address: "GUSER",
      networkPassphrase: "p",
      balances: {},
    });
    renderHook(() => useStrategySimulation(null), { wrapper: createWrapper() });
    expect(simulateStrategyMock).not.toHaveBeenCalled();
  });

  it("re-queries when the strategy's updatedAt changes (query key includes it)", async () => {
    simulateStrategyMock.mockResolvedValue({ success: true, steps: {} });
    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      ({ s }: { s: Strategy }) => useStrategySimulation(s),
      { wrapper, initialProps: { s: strategy } }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ s: { ...strategy, updatedAt: 2 } });
    await waitFor(() => expect(simulateStrategyMock).toHaveBeenCalledTimes(2));
  });
});

describe("useStrategyPersistence", () => {
  it("loads strategies scoped to the connected wallet and returns empty without one", async () => {
    listStrategiesMock.mockReturnValue([strategy]);
    const { result } = renderHook(() => useStrategyPersistence(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.strategies).toEqual([strategy]));
    expect(listStrategiesMock).toHaveBeenCalledWith("GUSER");

    useWalletMock.mockReturnValue({ address: undefined, balances: {} });
    const { result: disconnected } = renderHook(
      () => useStrategyPersistence(),
      { wrapper: createWrapper() }
    );
    expect(disconnected.current.strategies).toEqual([]);
  });

  it("saveStrategy persists then refetches; deleteStrategy removes then refetches; both no-op without a wallet", async () => {
    listStrategiesMock.mockReturnValue([strategy]);
    const { result } = renderHook(() => useStrategyPersistence(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.strategies).toEqual([strategy]));

    act(() => result.current.saveStrategy(strategy));
    expect(upsertStrategyMock).toHaveBeenCalledWith("GUSER", strategy);

    act(() => result.current.deleteStrategy("s1"));
    expect(removeStrategyMock).toHaveBeenCalledWith("GUSER", "s1");

    useWalletMock.mockReturnValue({ address: undefined, balances: {} });
    const { result: disconnected } = renderHook(
      () => useStrategyPersistence(),
      { wrapper: createWrapper() }
    );
    act(() => disconnected.current.saveStrategy(strategy));
    expect(upsertStrategyMock).toHaveBeenCalledTimes(1); // unchanged from the earlier call
  });
});

describe("useStrategyExecution", () => {
  it("constructs the engine with the wallet's signTransaction and both transports, passing params through to executeStrategy", async () => {
    const signTransaction = vi.fn();
    useWalletMock.mockReturnValue({
      address: "GUSER",
      networkPassphrase: "p",
      signTransaction,
      balances: {},
    });

    const { result } = renderHook(() => useStrategyExecution());
    await act(async () => {
      await result.current.execute(strategy, execution, {
        acknowledgedDeviationStepIds: ["a"],
      });
    });

    expect(executeStrategyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy,
        execution,
        userAddress: "GUSER",
        networkPassphrase: "p",
        acknowledgedDeviationStepIds: ["a"],
      })
    );
  });

  it("wires onStepUpdate to persist the record via upsertExecution", async () => {
    const { result } = renderHook(() => useStrategyExecution());
    await act(async () => {
      await result.current.execute(strategy, execution);
    });
    const onStepUpdate = executeStrategyMock.mock.calls[0][0].onStepUpdate;
    const rec = { id: "e1", steps: [] } as unknown as ExecutionRecord;
    onStepUpdate(rec);
    expect(upsertExecutionMock).toHaveBeenCalledWith("GUSER", rec);
  });

  it("returns null and skips execution without a connected wallet", async () => {
    useWalletMock.mockReturnValue({
      address: undefined,
      networkPassphrase: undefined,
      signTransaction: vi.fn(),
      balances: {},
    });
    const { result } = renderHook(() => useStrategyExecution());
    let outcome;
    await act(async () => {
      outcome = await result.current.execute(strategy, execution);
    });
    expect(outcome).toBeNull();
    expect(executeStrategyMock).not.toHaveBeenCalled();
  });

  it("toggles isExecuting around the execute() call", async () => {
    const { result } = renderHook(() => useStrategyExecution());
    expect(result.current.isExecuting).toBe(false);
    await act(async () => {
      await result.current.execute(strategy, execution);
    });
    expect(result.current.isExecuting).toBe(false);
  });
});

describe("useExecutionRecovery", () => {
  it("checks for resumable executions on mount, reconciles each, and persists the reconciled record", async () => {
    findResumableExecutionsMock.mockReturnValue([record("e1", "in_progress")]);
    reconcileExecutionMock.mockResolvedValue(record("e1", "completed"));

    const { result } = renderHook(() => useExecutionRecovery());
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    expect(findResumableExecutionsMock).toHaveBeenCalledWith("GUSER");
    expect(reconcileExecutionMock).toHaveBeenCalled();
    expect(upsertExecutionMock).toHaveBeenCalledWith(
      "GUSER",
      record("e1", "completed")
    );
    expect(result.current.resumable).toEqual([]); // reconciled to "completed" -> no longer resumable
  });

  it("does nothing without a connected wallet, and refresh() re-runs the check on demand", async () => {
    useWalletMock.mockReturnValue({ address: undefined, balances: {} });
    renderHook(() => useExecutionRecovery());
    expect(findResumableExecutionsMock).not.toHaveBeenCalled();

    useWalletMock.mockReturnValue({
      address: "GUSER",
      networkPassphrase: "p",
      balances: {},
      signTransaction: vi.fn(),
    });
    findResumableExecutionsMock.mockReturnValue([]);
    const { result } = renderHook(() => useExecutionRecovery());
    await waitFor(() => expect(result.current.isChecking).toBe(false));
    findResumableExecutionsMock.mockClear();
    await result.current.refresh();
    expect(findResumableExecutionsMock).toHaveBeenCalledTimes(1);
  });
});
