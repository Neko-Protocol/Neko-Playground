import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventPlatformDb } from "./supabaseServer";
import type { RaiseEventInput, RaiseEventResult } from "./types";

interface RawRpcResult {
  created: boolean;
  reason?: string;
  event_id?: string;
  incident_id?: string | null;
  escalated?: boolean;
}

/**
 * The single write path into the outbox. Delegates the entire
 * dedupe/hysteresis/suppression/escalation/correlation/enqueue decision to
 * `fn_raise_platform_event`, which runs it as one Postgres transaction (see
 * that function's comment for why this — not this TS function — is what
 * actually provides atomicity). `db` is injectable so callers/tests can pass
 * a fake satisfying the same `rpc()` shape without a live database.
 */
export async function raiseEvent(
  input: RaiseEventInput,
  db: SupabaseClient = getEventPlatformDb()
): Promise<RaiseEventResult> {
  const { data, error } = await db.rpc("fn_raise_platform_event", {
    p_source: input.source,
    p_wallet_address: input.walletAddress,
    p_dedupe_key: input.dedupeKey,
    p_event_type: input.eventType,
    p_severity: input.severity,
    p_payload: input.payload ?? {},
    p_is_resolution: input.isResolution ?? false,
    p_suppression_window_seconds: Math.round(
      (input.suppressionWindowMs ?? 300_000) / 1000
    ),
    p_correlation_window_seconds: Math.round(
      (input.correlationWindowMs ?? 300_000) / 1000
    ),
    p_escalation_cycle_threshold: input.escalationCycleThreshold ?? 3,
  });

  if (error) {
    throw new Error(`raiseEvent failed: ${error.message}`);
  }

  const result = data as RawRpcResult;
  return {
    created: result.created,
    reason: result.reason,
    eventId: result.event_id,
    incidentId: result.incident_id ?? null,
    escalated: result.escalated,
  };
}

/** Convenience wrapper for reporting that a previously-raised condition has cleared. */
export async function resolveEvent(
  input: Omit<RaiseEventInput, "isResolution" | "severity"> & {
    severity?: RaiseEventInput["severity"];
  },
  db: SupabaseClient = getEventPlatformDb()
): Promise<RaiseEventResult> {
  return raiseEvent(
    { ...input, severity: input.severity ?? "info", isResolution: true },
    db
  );
}
