export type HapticPattern =
  | "connect"
  | "success"
  | "error"
  | "warning"
  | "selection";

export const HAPTIC_PATTERNS: Record<HapticPattern, string> = {
  connect: "nudge",
  success: "success",
  error: "error",
  warning: "warning",
  selection: "nudge",
};
