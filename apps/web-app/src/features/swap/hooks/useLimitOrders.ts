"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  LimitOrder,
  LimitOrderSide,
  LimitOrderExpiry,
  LimitOrderStorageSchema,
} from "../types/limitOrder";
import { EXPIRY_MS } from "../types/limitOrder";
import { LIMIT_ORDER_STORAGE_VERSION } from "../constants/swapConfig";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { DEFAULT_SLIPPAGE_BPS } from "../constants/swapConfig";

// ─── Storage helpers ──────────────────────────────────────────────────────────

function storageKey(walletAddress: string): string {
  return `neko_limit_orders_v${LIMIT_ORDER_STORAGE_VERSION}_${walletAddress}`;
}

function loadFromStorage(walletAddress: string): LimitOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LimitOrderStorageSchema;
    if (parsed.version !== LIMIT_ORDER_STORAGE_VERSION) return [];
    return parsed.orders ?? [];
  } catch {
    return [];
  }
}

function saveToStorage(walletAddress: string, orders: LimitOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    const schema: LimitOrderStorageSchema = {
      version: LIMIT_ORDER_STORAGE_VERSION,
      orders,
    };
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(schema));
  } catch {
    // Storage quota exceeded or unavailable — fail silently.
  }
}

// ─── Hook public API ──────────────────────────────────────────────────────────

export interface AddLimitOrderParams {
  walletAddress: string;
  tokenIn: Token | string;
  tokenOut: Token | string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
  amountIn: string;
  limitPrice: string;
  side: LimitOrderSide;
  expiry: LimitOrderExpiry;
  slippageBps?: number;
}

export interface UseLimitOrdersReturn {
  orders: LimitOrder[];
  addOrder: (params: AddLimitOrderParams) => LimitOrder;
  cancelOrder: (id: string) => void;
  markFilled: (id: string) => void;
  markExpired: (id: string) => void;
  markReady: (id: string) => void;
  incrementConfirmation: (id: string) => void;
  resetConfirmation: (id: string) => void;
  clearOrders: () => void;
}

/**
 * Manages the in-memory list of limit orders for the connected wallet.
 * Persists to localStorage on every mutation.
 * Call `clearOrders()` on wallet disconnect.
 */
export function useLimitOrders(
  walletAddress: string | undefined
): UseLimitOrdersReturn {
  const [orders, setOrders] = useState<LimitOrder[]>(() => {
    if (!walletAddress) return [];
    return loadFromStorage(walletAddress);
  });

  // Re-hydrate when wallet address changes (connect / switch).
  useEffect(() => {
    if (!walletAddress) {
      setOrders([]);
      return;
    }
    setOrders(loadFromStorage(walletAddress));
  }, [walletAddress]);

  // Persist to localStorage whenever orders change.
  useEffect(() => {
    if (!walletAddress) return;
    saveToStorage(walletAddress, orders);
  }, [walletAddress, orders]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const mutate = useCallback(
    (updater: (prev: LimitOrder[]) => LimitOrder[]) => {
      setOrders((prev) => updater(prev));
    },
    []
  );

  // ── Public Actions ────────────────────────────────────────────────────────

  const addOrder = useCallback(
    (params: AddLimitOrderParams): LimitOrder => {
      const expiryMs = EXPIRY_MS[params.expiry];
      const now = Date.now();
      const order: LimitOrder = {
        id: crypto.randomUUID(),
        walletAddress: params.walletAddress,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        tokenInSymbol: params.tokenInSymbol,
        tokenOutSymbol: params.tokenOutSymbol,
        amountIn: params.amountIn,
        limitPrice: params.limitPrice,
        side: params.side,
        slippageBps: params.slippageBps ?? DEFAULT_SLIPPAGE_BPS,
        status: "open",
        createdAt: now,
        expiresAt: expiryMs !== null ? now + expiryMs : null,
        consecutiveConfirmations: 0,
        filledAt: null,
      };
      mutate((prev) => [order, ...prev]);
      return order;
    },
    [mutate]
  );

  const cancelOrder = useCallback(
    (id: string) => {
      mutate((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "cancelled" } : o))
      );
    },
    [mutate]
  );

  const markFilled = useCallback(
    (id: string) => {
      mutate((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, status: "filled", filledAt: Date.now() } : o
        )
      );
    },
    [mutate]
  );

  const markExpired = useCallback(
    (id: string) => {
      mutate((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "expired" } : o))
      );
    },
    [mutate]
  );

  const markReady = useCallback(
    (id: string) => {
      mutate((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "ready" } : o))
      );
    },
    [mutate]
  );

  const incrementConfirmation = useCallback(
    (id: string) => {
      mutate((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, consecutiveConfirmations: o.consecutiveConfirmations + 1 }
            : o
        )
      );
    },
    [mutate]
  );

  const resetConfirmation = useCallback(
    (id: string) => {
      mutate((prev) =>
        prev.map((o) =>
          o.id === id ? { ...o, consecutiveConfirmations: 0 } : o
        )
      );
    },
    [mutate]
  );

  const clearOrders = useCallback(() => {
    setOrders([]);
  }, []);

  return {
    orders,
    addOrder,
    cancelOrder,
    markFilled,
    markExpired,
    markReady,
    incrementConfirmation,
    resetConfirmation,
    clearOrders,
  };
}
