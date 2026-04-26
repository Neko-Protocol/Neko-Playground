export type HapticPattern =
  | "connect"
  | "success"
  | "error"
  | "warning"
  | "selection";

export const HAPTIC_PATTERNS: Record<HapticPattern, number | number[]> = {
  connect: [12],
  success: [18],
  error: [25, 40, 25],
  warning: [15, 25, 15],
  selection: [8],
};
