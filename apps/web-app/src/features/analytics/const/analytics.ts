import type { TimeWindow, EarningsSourceId } from "../types/analytics";

export const TIME_WINDOWS: { label: string; value: TimeWindow }[] = [
  { label: "24H", value: "24h" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "YTD", value: "ytd" },
  { label: "All", value: "all" },
];

export const SOURCE_LABELS: Record<EarningsSourceId, string> = {
  vault: "Vault",
  lending: "Lending",
  pools: "Pools",
  rwa: "RWA",
};

export const SOURCE_COLORS: Record<EarningsSourceId, string> = {
  vault: "#68f9f2",
  lending: "#1daca9",
  pools: "#2bb8d7",
  rwa: "#7096D1",
};

export const CHART_COLORS = [
  "#68f9f2",
  "#1dd1b3",
  "#2bb8d7",
  "#7096D1",
  "#334EAC",
  "#1daca9",
  "#39bfb7",
  "#31c1c6",
];

export const RISK_SCORE_THRESHOLDS = {
  low: 33,
  medium: 66,
} as const;

export const DEFAULT_TIME_WINDOW: TimeWindow = "30d";

export const WINDOW_DAYS: Record<TimeWindow, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
  ytd: new Date().getDate() + new Date().getMonth() * 30,
  all: 365,
};
