"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { rpc } from "@stellar/stellar-sdk";
import { useWallet } from "@/hooks/useWallet";
import { sendTransaction as soroswapSendTransaction } from "@/lib/helpers/stellar/soroswap";
import {
  confirmTransactionHash,
  submitSignedTransaction,
} from "@/lib/helpers/stellar/executeTransaction";
import { getSorobanServer } from "@/lib/helpers/stellar/sorobanServer";
import type { MappedBalances } from "@/lib/helpers/stellar/wallet";
import { strategyStepRegistry } from "./registry";
import "./definitions";
import { validateStrategy, simulateStrategy } from "./engine";
import {
  listStrategies,
  upsertStrategy as upsertStrategyStorage,
  removeStrategy as removeStrategyStorage,
  upsertExecution,
} from "./persistence";
import {
  ExecutionEngine,
  findResumableExecutions,
  reconcileExecution,
  type ExecuteStrategyResult,
  type OnChainTxStatus,
  type TransportAdapter,
} from "./execution";
import type { ExecutionRecord, Strategy, ValidationResult } from "./types";

// ─── Balance flattening ──────────────────────────────────────────────────────

/**
 * useWallet().balances is keyed by Horizon/Soroban entry shape ("xlm",
 * "CODE:ISSUER", "soroban:CODE"), not a plain asset code. validateStrategy's
 * balance check needs a simple assetCode -> decimal-string map, so this
 * flattens the common cases (native XLM, Soroban token balances) into that
 * shape. Classic "CODE:ISSUER" trustline balances are intentionally left
 * out — the strategy engine only moves Soroban-native/SAC assets today.
 */
export function flattenBalancesByAssetCode(
  balances: MappedBalances
): Record<string, string> {
  const flattened: Record<string, string> = {};
  for (const [key, entry] of Object.entries(balances)) {
    if (key === "xlm") {
      flattened.XLM = entry.balance;
      continue;
    }
    if (key.startsWith("soroban:"))
      flattened[key.slice("soroban:".length)] = entry.balance;
  }
  return flattened;
}

// ─── Definitions ─────────────────────────────────────────────────────────────

/** Lists every registered step definition, for the composer's step palette. */
export function useStrategyDefinitions() {
  return useMemo(() => strategyStepRegistry.listRegistered(), []);
}

// ─── Validation ──────────────────────────────────────────────────────────────

const EMPTY_VALIDATION_RESULT: ValidationResult = { valid: true, issues: [] };

/**
 * validateStrategy() is pure and synchronous (no network calls), so this
 * recomputes on every relevant change via useMemo rather than a debounced
 * effect — there's no async work to throttle.
 */
export function useStrategyValidation(
  strategy: Strategy | null
): ValidationResult {
  const { address, networkPassphrase, balances } = useWallet();
  return useMemo(() => {
    if (!strategy) return EMPTY_VALIDATION_RESULT;
    return validateStrategy(strategy, {
      userAddress: address,
      networkPassphrase,
      balances: flattenBalancesByAssetCode(balances),
    });
  }, [strategy, address, networkPassphrase, balances]);
}

// ─── Simulation ──────────────────────────────────────────────────────────────

export const STRATEGY_SIMULATION_QUERY_KEY = "defi-strategy-simulation";

export function useStrategySimulation(
  strategy: Strategy | null,
  enabled = true
) {
  const { address, networkPassphrase } = useWallet();
  return useQuery({
    queryKey: [
      STRATEGY_SIMULATION_QUERY_KEY,
      strategy?.id,
      strategy?.updatedAt,
      address,
    ],
    queryFn: () =>
      simulateStrategy(strategy!, {
        userAddress: address!,
        networkPassphrase: networkPassphrase!,
      }),
    enabled:
      enabled &&
      Boolean(strategy) &&
      Boolean(address) &&
      Boolean(networkPassphrase),
    staleTime: 10_000,
    retry: false,
    throwOnError: false,
  });
}

// ─── Persistence ─────────────────────────────────────────────────────────────

export const DEFI_STRATEGIES_QUERY_KEY = "defi-strategies";

/** CRUD over versioned localStorage-backed strategy definitions, scoped to the connected wallet. */
export function useStrategyPersistence() {
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const queryKey = [DEFI_STRATEGIES_QUERY_KEY, address];

  const query = useQuery({
    queryKey,
    queryFn: () => listStrategies(address!),
    enabled: Boolean(address),
    staleTime: Infinity,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient, address]);

  const saveStrategy = useCallback(
    (strategy: Strategy) => {
      if (!address) return;
      upsertStrategyStorage(address, strategy);
      invalidate();
    },
    [address, invalidate]
  );

  const deleteStrategy = useCallback(
    (strategyId: string) => {
      if (!address) return;
      removeStrategyStorage(address, strategyId);
      invalidate();
    },
    [address, invalidate]
  );

  return {
    strategies: query.data ?? [],
    isLoading: query.isLoading,
    saveStrategy,
    deleteStrategy,
  };
}

// ─── Execution ───────────────────────────────────────────────────────────────

function makeRpcTransport(): TransportAdapter {
  return {
    async submit(signedXdr, networkPassphrase) {
      return submitSignedTransaction(signedXdr, networkPassphrase);
    },
    async confirm(hash) {
      return confirmTransactionHash(hash);
    },
  };
}

function makeSoroswapTransport(): TransportAdapter {
  return {
    async submit(signedXdr) {
      const result = await soroswapSendTransaction({
        xdr: signedXdr,
        launchtube: false,
      });
      return { hash: result.txHash };
    },
    async confirm(hash) {
      return confirmTransactionHash(hash);
    },
  };
}

export interface ExecuteOptions {
  acknowledgedDeviationStepIds?: string[];
}

/**
 * Owns the guided ExecutionEngine, wiring its transport-agnostic
 * prepare/sign/submit/confirm sequence to real RPC + SoroSwap-API
 * submission, and persisting the record after every step (recovery reads
 * this same store).
 */
export function useStrategyExecution() {
  const { address, networkPassphrase, signTransaction } = useWallet();
  const [isExecuting, setIsExecuting] = useState(false);

  const execute = useCallback(
    async (
      strategy: Strategy,
      execution: ExecutionRecord,
      options?: ExecuteOptions
    ): Promise<ExecuteStrategyResult | null> => {
      if (!address || !networkPassphrase) return null;
      setIsExecuting(true);
      try {
        const engine = new ExecutionEngine({
          sign: signTransaction,
          transports: {
            rpc: makeRpcTransport(),
            soroswapApi: makeSoroswapTransport(),
          },
        });
        return await engine.executeStrategy({
          strategy,
          execution,
          userAddress: address,
          networkPassphrase,
          acknowledgedDeviationStepIds: options?.acknowledgedDeviationStepIds,
          onStepUpdate: (record) => upsertExecution(address, record),
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [address, networkPassphrase, signTransaction]
  );

  return { execute, isExecuting, hasWallet: Boolean(address) };
}

// ─── Execution recovery ──────────────────────────────────────────────────────

async function getTransactionStatus(
  server: rpc.Server,
  hash: string
): Promise<OnChainTxStatus> {
  try {
    const result = await server.getTransaction(hash);
    if (result.status === "SUCCESS") return "SUCCESS";
    if (result.status === "FAILED") return "FAILED";
    if (result.status === "NOT_FOUND") return "NOT_FOUND";
    return "PENDING";
  } catch {
    return "NOT_FOUND";
  }
}

/**
 * On mount (app reopen), scans persisted execution history for unfinished
 * runs, reconciles any still-in-flight step against the chain, and
 * surfaces what's left as resumable — the data ResumeExecutionBanner reads.
 */
export function useExecutionRecovery() {
  const { address } = useWallet();
  const [resumable, setResumable] = useState<ExecutionRecord[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const check = useCallback(async () => {
    if (!address) {
      setResumable([]);
      return;
    }
    setIsChecking(true);
    try {
      const unfinished = findResumableExecutions(address);
      const server = getSorobanServer();
      const reconciled = await Promise.all(
        unfinished.map((record) =>
          reconcileExecution(record, {
            getTransactionStatus: (hash) => getTransactionStatus(server, hash),
          })
        )
      );
      reconciled.forEach((record) => upsertExecution(address, record));
      setResumable(
        reconciled.filter(
          (r) => r.status === "in_progress" || r.status === "paused-deviation"
        )
      );
    } finally {
      setIsChecking(false);
    }
  }, [address]);

  useEffect(() => {
    void check();
  }, [check]);

  return { resumable, isChecking, refresh: check };
}
