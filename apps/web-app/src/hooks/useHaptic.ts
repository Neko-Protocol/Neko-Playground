"use client";

import { useCallback, useMemo } from "react";
import { useWebHaptics } from "web-haptics/react";
import { HAPTIC_PATTERNS, type HapticPattern } from "@/lib/constants/haptics";

export type { HapticPattern } from "@/lib/constants/haptics";

let audioCtx: AudioContext | null = null;
let audioUnlockBound = false;
let audioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

type SoundKind = HapticPattern | "fallback";

function playTone(
  ctx: AudioContext,
  now: number,
  frequency: number,
  duration: number,
  gainAmount: number,
  type: OscillatorType = "sine"
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainAmount, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.01);
}

async function ensureAudioRunning(): Promise<AudioContext | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (ctx.state === "running") return ctx;

  try {
    await ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function playPatternSound(kind: SoundKind) {
  void ensureAudioRunning().then((ctx) => {
    if (!ctx) return;

    const now = ctx.currentTime;
    if (kind === "success") {
      playTone(ctx, now, 720, 0.045, 0.018, "sine");
      playTone(ctx, now + 0.06, 860, 0.045, 0.016, "sine");
      return;
    }

    if (kind === "warning") {
      playTone(ctx, now, 640, 0.04, 0.015, "sine");
      playTone(ctx, now + 0.08, 640, 0.04, 0.014, "sine");
      return;
    }

    if (kind === "error") {
      playTone(ctx, now, 430, 0.045, 0.02, "triangle");
      playTone(ctx, now + 0.07, 380, 0.05, 0.018, "triangle");
      return;
    }

    if (kind === "selection") {
      playTone(ctx, now, 780, 0.03, 0.012, "sine");
      return;
    }

    if (kind === "connect") {
      playTone(ctx, now, 620, 0.04, 0.014, "sine");
      playTone(ctx, now + 0.05, 760, 0.04, 0.013, "sine");
      return;
    }

    // Extra fallback sound "por si acaso".
    playTone(ctx, now, 680, 0.035, 0.01, "sine");
  });
}

function bindAudioUnlock() {
  if (typeof window === "undefined" || audioUnlockBound) return;
  audioUnlockBound = true;
  const unlock = () => {
    if (audioUnlocked) return;
    void ensureAudioRunning().then((ctx) => {
      if (!ctx) return;
      // Warm-up envelope to ensure audio graph is initialized on mobile.
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.connect(ctx.destination);
      audioUnlocked = true;
      // Audible confirmation after first user gesture unlock.
      playPatternSound("fallback");
    });
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("touchend", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
}

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
  // Allow mobile Safari/PWA audio fallback from web-haptics even when
  // Vibration API is unavailable.
  return true;
}

/**
 * iOS Safari/PWA does not expose a standard web vibration API.
 * We intentionally keep a silent no-op fallback on unsupported devices.
 */
export function useHaptic() {
  const canHaptic = useMemo(() => canUseHaptics(), []);
  const { trigger: webTrigger } = useWebHaptics({ debug: true });
  bindAudioUnlock();

  const trigger = useCallback(
    (pattern: HapticPattern) => {
      if (!canUseHaptics()) return;
      playPatternSound(pattern);
      void webTrigger?.(HAPTIC_PATTERNS[pattern]);
    },
    [webTrigger]
  );

  return { trigger, canHaptic };
}
