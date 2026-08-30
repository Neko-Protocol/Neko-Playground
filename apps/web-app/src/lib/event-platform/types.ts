/**
 * Shared types for the durable event platform. `EventSource` is the single
 * canonical producer-identifier union — `ActivityEvent["source"]` imports it
 * rather than declaring its own, so a future producer added here
 * automatically becomes a valid activity-store source too.
 */
export type EventSource = "swap" | "automation" | "vault" | "borrowing";

export type Severity = "info" | "warning" | "critical";

export type DeliveryChannelType = "in_app" | "webhook" | "email";

export type DeliveryStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "failed"
  | "dead_letter";

export interface PlatformEvent {
  id: string;
  source: EventSource;
  walletAddress: string;
  dedupeKey: string;
  eventType: string;
  severity: Severity;
  payload: Record<string, unknown>;
  incidentId: string | null;
  createdAt: string;
}

export interface EventDelivery {
  id: string;
  eventId: string;
  channel: DeliveryChannelType;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
  deliveredAt: string | null;
}

export interface RaiseEventInput {
  source: EventSource;
  walletAddress: string;
  /** Identifies the ongoing condition this event belongs to, e.g. `hf-breach:${contractId}`. */
  dedupeKey: string;
  eventType: string;
  severity: Severity;
  payload?: Record<string, unknown>;
  /** True when this call reports the condition has cleared, not a new breach. */
  isResolution?: boolean;
  suppressionWindowMs?: number;
  correlationWindowMs?: number;
  escalationCycleThreshold?: number;
}

export interface RaiseEventResult {
  created: boolean;
  reason?: string;
  eventId?: string;
  incidentId?: string | null;
  escalated?: boolean;
}

export interface NotificationPreferences {
  walletAddress: string;
  sources: EventSource[];
  minSeverity: Severity;
  channels: DeliveryChannelType[];
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
  digestMode: "immediate" | "digest";
}

export interface NotificationChannelConfig {
  id: string;
  walletAddress: string;
  channelType: Extract<DeliveryChannelType, "webhook" | "email">;
  destination: string;
  verifiedAt: string | null;
}

export interface Incident {
  id: string;
  walletAddress: string;
  title: string;
  severity: Severity;
  status: "open" | "resolved";
  createdAt: string;
}
