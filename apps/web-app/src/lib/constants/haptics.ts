import type { HapticInput } from "web-haptics";

export type HapticPattern =
  | "connect"
  | "success"
  | "error"
  | "warning"
  | "selection";

export const HAPTIC_SUCCESS_PATTERN: HapticInput = [
  { duration: 30 },
  { delay: 60, duration: 40, intensity: 1 },
];

export const HAPTIC_ERROR_PATTERN: HapticInput = [
  { duration: 40, intensity: 0.7 },
  { delay: 40, duration: 40, intensity: 0.7 },
  { delay: 40, duration: 40, intensity: 0.9 },
  { delay: 40, duration: 50, intensity: 0.6 },
];

export const HAPTIC_PATTERNS: Record<HapticPattern, HapticInput> = {
  connect: "nudge",
  success: HAPTIC_SUCCESS_PATTERN,
  error: HAPTIC_ERROR_PATTERN,
  warning: [
    { duration: 40, intensity: 0.8 },
    { delay: 100, duration: 40, intensity: 0.6 },
  ],
  selection: "selection",
};
