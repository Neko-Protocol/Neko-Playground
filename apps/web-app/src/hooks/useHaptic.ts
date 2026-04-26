"use client";

import { useCallback, useMemo } from "react";
import { HAPTIC_PATTERNS, type HapticPattern } from "@/lib/constants/haptics";

export type { HapticPattern } from "@/lib/constants/haptics";

function isDesktopNoTouch(): boolean {
  if (typeof navigator === "undefined") return true;
  const points = navigator.maxTouchPoints ?? 0;
  return points === 0;
}

function prefersReducedMotion(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function canUseHaptics(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  if (prefersReducedMotion()) return false;
  if (isDesktopNoTouch()) return false;
  return typeof navigator.vibrate === "function";
}

export function triggerHaptic(pattern: HapticPattern): boolean {
  if (!canUseHaptics()) return false;
  return navigator.vibrate(HAPTIC_PATTERNS[pattern]);
}

/**
 * iOS Safari/PWA does not expose a standard web vibration API.
 * We intentionally keep a silent no-op fallback on unsupported devices.
 */
export function useHaptic() {
  const canHaptic = useMemo(() => canUseHaptics(), []);

  const trigger = useCallback((pattern: HapticPattern) => {
    void triggerHaptic(pattern);
  }, []);

  return { trigger, canHaptic };
}
