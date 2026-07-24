export type StrategiesTab = "my-strategies" | "templates" | "history";

export const STRATEGIES_TABS: { key: StrategiesTab; label: string }[] = [
  { key: "my-strategies", label: "My Strategies" },
  { key: "templates", label: "Templates" },
  { key: "history", label: "Execution History" },
];

export function formatPercent(value: number | null, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`;
}

export function formatNumber(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

export function formatMultiplier(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}
