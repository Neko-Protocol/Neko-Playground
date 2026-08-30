import type { EventSource } from "@/lib/event-platform/types";

export interface ActivityEvent {
  id: string; // UUID
  // The platform's producer-identifier union (see lib/event-platform/types) —
  // a source added there automatically gets durable delivery with no change here.
  source: EventSource;
  type: string; // e.g. "limit-order-ready", "limit-order-expired", "plan-confirmed", "plan-cancelled", "deposit", "withdraw"
  timestamp: number; // UTC ms
  summary: string; // Human-readable description
  link: string; // Route to navigate to (e.g. "/swap", "/automation")
  metadata?: Record<string, string | number | boolean | null>; // Optional extra data
  read: boolean; // Has user seen this?
}
