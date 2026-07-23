/**
 * Risk-alert types — borrow-position health-factor alerting.
 *
 * Two distinct concepts, kept separate on purpose:
 *  - `AlertThreshold` / `ThresholdMap`: user configuration ("notify me below
 *    HF X").  Editable.
 *  - `RiskAlert`: an immutable, timestamped record of a threshold breach.
 *
 * Both are persisted to localStorage, namespaced per wallet address, mirroring
 * the pattern used by `features/swap/hooks/useLimitOrders`.
 *
 * The unit of a "position" is the pool contract id — health factor in Neko is
 * computed per pool (see `useHealthFactor`).
 */

// ─── Storage schema versions ─────────────────────────────────────────────────
/** Bump to invalidate incompatible persisted threshold data. */
export const RISK_THRESHOLD_STORAGE_VERSION = 1;
/** Bump to invalidate incompatible persisted alert data. */
export const RISK_ALERT_STORAGE_VERSION = 1;

// ─── Threshold configuration ─────────────────────────────────────────────────

/** A per-position alert threshold configured by the user. */
export interface AlertThreshold {
  /** Pool contract id this threshold applies to. */
  contractId: string;
  /** Health factor below which an alert is raised. */
  threshold: number;
}

/** Map of `contractId` → threshold value, as persisted. */
export type ThresholdMap = Record<string, number>;

// ─── Alert record ────────────────────────────────────────────────────────────

/** Which boundary a position crossed to raise an alert. */
export type RiskAlertKind = "threshold" | "danger-zone";

/** An immutable record of a health-factor breach. */
export interface RiskAlert {
  /** Unique identifier (UUID v4). */
  id: string;
  /** Pool contract id whose position breached. */
  contractId: string;
  /** Human-readable pool label captured at breach time (e.g. "Pool 1"). */
  poolLabel: string;
  /** Which boundary was crossed. */
  kind: RiskAlertKind;
  /** Health factor captured at the exact moment of the breach. */
  healthFactorAtBreach: number;
  /** User threshold in effect at breach time; null for danger-zone-only. */
  thresholdAtBreach: number | null;
  /** UTC timestamp (ms) when the breach was detected. */
  createdAt: number;
  /** Whether the user has dismissed this alert from the list. */
  dismissed: boolean;
}

/**
 * Per-position breach flag, persisted so an ongoing breach is not re-alerted
 * after a page reload.  `true` means "currently considered in breach" (held
 * through the hysteresis band).
 */
export type BreachStateMap = Record<string, boolean>;

// ─── Storage schemas ─────────────────────────────────────────────────────────

export interface ThresholdStorageSchema {
  version: number;
  thresholds: ThresholdMap;
}

export interface AlertStorageSchema {
  version: number;
  alerts: RiskAlert[];
  breach: BreachStateMap;
}
