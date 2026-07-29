export interface ActivityEvent {
  id: string; // UUID
  source: "swap" | "automation" | "vault"; // extensible union
  type: string; // e.g. "limit-order-ready", "limit-order-expired", "plan-confirmed", "plan-cancelled", "deposit", "withdraw"
  timestamp: number; // UTC ms
  summary: string; // Human-readable description
  link: string; // Route to navigate to (e.g. "/swap", "/automation")
  metadata?: Record<string, string | number | boolean | null>; // Optional extra data
  read: boolean; // Has user seen this?
}
