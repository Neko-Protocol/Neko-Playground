"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  POLL_INTERVAL_MS,
  MAX_POLL_DURATION_MS,
  POLL_MAX_INTERVAL_MS,
  POLL_UNREACHABLE_AFTER,
} from "../constants/ramp.config";
import type { PollOutcome } from "../types/ramp";

interface UseAnchorPollingOptions<T> {
  enabled: boolean;
  queryFn: (signal: AbortSignal) => Promise<T | null>;
  isTerminal: (data: T) => boolean;
  intervalMs?: number;
  deadlineMs?: number;
  unreachableAfter?: number;
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export function useAnchorPolling<T>({
  enabled,
  queryFn,
  isTerminal,
  intervalMs = POLL_INTERVAL_MS,
  deadlineMs = MAX_POLL_DURATION_MS,
  unreachableAfter = POLL_UNREACHABLE_AFTER,
}: UseAnchorPollingOptions<T>) {
  const [outcome, setOutcome] = useState<PollOutcome>("pending");
  const [pollSession, setPollSession] = useState(0);

  const queryFnRef = useRef(queryFn);
  const isTerminalRef = useRef(isTerminal);

  useEffect(() => {
    queryFnRef.current = queryFn;
    isTerminalRef.current = isTerminal;
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const retry = useCallback(() => {
    setPollSession((session) => session + 1);
    setOutcome("pending");
  }, []);

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;
    let currentInterval = intervalMs;
    const deadlineAt = Date.now() + deadlineMs;

    const scheduleNext = (delay: number) => {
      if (cancelled) return;
      timeoutId = setTimeout(() => {
        void poll();
      }, delay);
    };

    const poll = async () => {
      if (cancelled) return;

      if (Date.now() >= deadlineAt) {
        setOutcome("timed-out");
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await queryFnRef.current(controller.signal);
        if (cancelled || controller.signal.aborted) return;

        consecutiveFailures = 0;
        currentInterval = intervalMs;

        if (result !== null && isTerminalRef.current(result)) {
          setOutcome("terminal");
          return;
        }
      } catch (error) {
        if (cancelled || isAbortError(error)) return;

        consecutiveFailures += 1;
        currentInterval = Math.min(
          intervalMs * 2 ** (consecutiveFailures - 1),
          POLL_MAX_INTERVAL_MS
        );

        if (consecutiveFailures >= unreachableAfter) {
          setOutcome("unreachable");
          return;
        }
      }

      if (Date.now() >= deadlineAt) {
        setOutcome("timed-out");
        return;
      }

      scheduleNext(currentInterval);
    };

    scheduleNext(0);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      abortControllerRef.current?.abort();
    };
  }, [enabled, pollSession, intervalMs, deadlineMs, unreachableAfter]);

  useEffect(() => {
    if (!enabled) {
      abortControllerRef.current?.abort();
    }
  }, [enabled]);

  return { outcome, retry };
}
