"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  getQuote,
  hasApiKey,
  type QuoteRequest,
} from "@/lib/helpers/stellar/soroswap";
import { formatSwapAmount, fromSmallestUnit } from "@/lib/helpers/tokenUtils";
import {
  LIMIT_ORDER_POLL_INTERVAL_MS,
  LIMIT_ORDER_CONFIRM_POLLS,
  DEFAULT_SLIPPAGE_BPS,
  MAX_HOPS,
} from "../constants/swapConfig";
import {
  matchLimitOrder,
  deriveMarketPrice,
} from "../utils/limitOrderMatching";
import type { UseLimitOrdersReturn } from "./useLimitOrders";
import type { LimitOrder } from "../types/limitOrder";
import type { Token } from "@/lib/helpers/stellar/soroswap";
import { useActivityStore } from "@/stores/activityStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UseLimitOrderMonitorOptions {
  /** Connected wallet address — monitoring is disabled when undefined. */
  walletAddress: string | undefined;

  /** Full order list from useLimitOrders. */
  orders: LimitOrder[];

  /** Mutation helpers from useLimitOrders. */
  actions: Pick<
    UseLimitOrdersReturn,
    | "markReady"
    | "markExpired"
    | "incrementConfirmation"
    | "resetConfirmation"
    | "clearOrders"
  >;

  /**
   * Called when an order transitions to "ready".
   * Use this to fire a toast notification.
   */
  onOrderReady?: (order: LimitOrder) => void;
}

// ─── Quote fetcher (standalone, no hook deps) ─────────────────────────────────

async function fetchCurrentPrice(
  amountIn: string,
  tokenIn: Token | string,
  tokenOut: Token | string
): Promise<number | null> {
  try {
    const request: QuoteRequest = {
      assetIn: tokenIn,
      assetOut: tokenOut,
      amount: amountIn,
      tradeType: "EXACT_IN",
      protocols: ["soroswap", "phoenix", "aqua"],
      slippageBps: DEFAULT_SLIPPAGE_BPS,
      maxHops: MAX_HOPS,
    };
    const quote = await getQuote(request);
    if (!quote?.amountOut) return null;

    const amountOutStr = quote.amountOut.toString();
    const amountOutBigInt = BigInt(amountOutStr);
    if (amountOutBigInt <= BigInt(0)) return null;

    const formattedOut = formatSwapAmount(fromSmallestUnit(amountOutStr, 7), 6);
    return deriveMarketPrice(amountIn, formattedOut);
  } catch {
    return null;
  }
}

// ─── Monitor Hook ─────────────────────────────────────────────────────────────

/**
 * Polls Soroswap quotes on an interval for every "open" limit order.
 * Uses double-poll confirmation before marking an order "ready".
 * Auto-expires orders past their expiresAt timestamp.
 * Calls `clearOrders()` when walletAddress goes from defined → undefined.
 */
export function useLimitOrderMonitor({
  walletAddress,
  orders,
  actions,
  onOrderReady,
}: UseLimitOrderMonitorOptions): void {
  const {
    markReady,
    markExpired,
    incrementConfirmation,
    resetConfirmation,
    clearOrders,
  } = actions;
  const prevAddressRef = useRef<string | undefined>(walletAddress);
  const apiKeyConfigured = hasApiKey();

  // Detect wallet disconnect and clear in-memory orders.
  useEffect(() => {
    const prev = prevAddressRef.current;
    prevAddressRef.current = walletAddress;
    if (prev !== undefined && walletAddress === undefined) {
      clearOrders();
    }
  }, [walletAddress, clearOrders]);

  // Keep a stable ref to the latest orders so the interval callback
  // always sees the freshest list without re-creating the interval.
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const onOrderReadyRef = useRef(onOrderReady);
  useEffect(() => {
    onOrderReadyRef.current = onOrderReady;
  }, [onOrderReady]);

  // Re-entrancy guard: prevents overlapping poll() runs when a previous
  // run is still awaiting quotes (SDK timeout can exceed the poll interval).
  const inFlightRef = useRef(false);

  const poll = useCallback(async () => {
    if (!walletAddress || !apiKeyConfigured) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const now = Date.now();
      const activeOrders = ordersRef.current.filter(
        (o) => o.status === "open" || o.status === "ready"
      );

      for (const order of activeOrders) {
        // ── Expiry check ──────────────────────────────────────────────────
        if (order.expiresAt !== null && now >= order.expiresAt) {
          markExpired(order.id);
          useActivityStore.getState().pushEvent({
            source: "swap",
            type: "limit-order-expired",
            timestamp: Date.now(),
            summary: `Limit order expired: Sell ${order.amountIn} ${order.tokenInSymbol} for ${order.tokenOutSymbol}`,
            link: "/swap",
          });
          continue;
        }

        // Only monitor "open" orders for price crossing.
        if (order.status !== "open") continue;

        // ── Price fetch ────────────────────────────────────────────────────
        const currentPrice = await fetchCurrentPrice(
          order.amountIn,
          order.tokenIn,
          order.tokenOut
        );

        if (currentPrice === null || !isFinite(currentPrice)) {
          // Stale quote — reset confirmations to avoid false positives.
          resetConfirmation(order.id);
          continue;
        }

        // ── Matching ───────────────────────────────────────────────────────
        const { shouldTrigger } = matchLimitOrder({
          side: order.side,
          limitPrice: parseFloat(order.limitPrice),
          currentPrice,
          slippageBps: order.slippageBps,
        });

        if (shouldTrigger) {
          // incrementConfirmation returns the new count computed inside the
          // setState updater, so it is deterministic regardless of React's
          // commit timing relative to this async poll loop.
          const confirmations = incrementConfirmation(order.id);

          if (confirmations >= LIMIT_ORDER_CONFIRM_POLLS) {
            // markReady returns the current order if it actually transitioned
            // to "ready" (i.e. was still "open"), or null otherwise. This
            // guarantees the activity event and callback fire exactly once.
            const readyOrder = markReady(order.id);
            if (readyOrder) {
              useActivityStore.getState().pushEvent({
                source: "swap",
                type: "limit-order-ready",
                timestamp: Date.now(),
                summary: `Limit order ready: Sell ${readyOrder.amountIn} ${readyOrder.tokenInSymbol} for ${readyOrder.tokenOutSymbol}`,
                link: "/swap",
              });
              onOrderReadyRef.current?.(readyOrder);
            }
          }
        } else {
          resetConfirmation(order.id);
        }
      }
    } finally {
      inFlightRef.current = false;
    }

  }, [
    walletAddress,
    apiKeyConfigured,
    markReady,
    markExpired,
    incrementConfirmation,
    resetConfirmation,
  ]);

  useEffect(() => {
    if (!walletAddress || !apiKeyConfigured) return;

    // Run once immediately, then on interval.
    void poll();
    const intervalId = setInterval(() => {
      void poll();
    }, LIMIT_ORDER_POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [walletAddress, apiKeyConfigured, poll]);
}
