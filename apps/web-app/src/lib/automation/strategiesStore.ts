import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import { requireServerEnv } from "@/lib/env.server";
import type { Strategy } from "@/features/automation/types/automation";

// ─── Row <-> domain mapping ──────────────────────────────────────────────

interface StrategyRow {
  id: string;
  name: string;
  preset: Strategy["preset"];
  rule: Strategy["rule"];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
}

function mapStrategyRow(row: StrategyRow): Strategy {
  return {
    id: row.id,
    name: row.name,
    preset: row.preset,
    rule: row.rule,
    enabled: row.enabled,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    ...(row.last_run_at
      ? { lastRunAt: new Date(row.last_run_at).getTime() }
      : {}),
  };
}

let cachedClient: SupabaseClient | null = null;

function getAutomationClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireServerEnv([
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]);
  cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  return cachedClient;
}

export class SupabaseStrategiesStore {
  async list(): Promise<Strategy[]> {
    const { data, error } = await getAutomationClient()
      .from("automation_strategies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as StrategyRow[]).map(mapStrategyRow);
  }

  async get(id: string): Promise<Strategy | null> {
    const { data, error } = await getAutomationClient()
      .from("automation_strategies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStrategyRow(data as StrategyRow) : null;
  }

  async create(input: {
    name: string;
    preset: Strategy["preset"];
    rule: Strategy["rule"];
    enabled: boolean;
  }): Promise<Strategy> {
    const now = Date.now();
    const { data, error } = await getAutomationClient()
      .from("automation_strategies")
      .insert({
        id: nanoid(),
        name: input.name,
        preset: input.preset,
        rule: input.rule,
        enabled: input.enabled,
        created_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapStrategyRow(data as StrategyRow);
  }

  async update(
    id: string,
    patch: Partial<Omit<Strategy, "id">>
  ): Promise<Strategy | null> {
    const row: Record<string, unknown> = {
      updated_at: new Date(Date.now()).toISOString(),
    };
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.preset !== undefined) row.preset = patch.preset;
    if (patch.rule !== undefined) row.rule = patch.rule;
    if (patch.enabled !== undefined) row.enabled = patch.enabled;
    if (patch.createdAt !== undefined) {
      row.created_at = new Date(patch.createdAt).toISOString();
    }
    if (patch.lastRunAt !== undefined) {
      row.last_run_at = new Date(patch.lastRunAt).toISOString();
    }

    const { data, error } = await getAutomationClient()
      .from("automation_strategies")
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapStrategyRow(data as StrategyRow) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { data, error } = await getAutomationClient()
      .from("automation_strategies")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
}

let sharedStore: SupabaseStrategiesStore | null = null;

/** Process-wide singleton for API routes — one Supabase-backed store per server process. */
export function getStrategiesStore(): SupabaseStrategiesStore {
  sharedStore ??= new SupabaseStrategiesStore();
  return sharedStore;
}
