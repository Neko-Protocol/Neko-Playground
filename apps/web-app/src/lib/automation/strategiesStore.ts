import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PRESET_RULES } from "@/features/automation/const/automation";
import type {
  Strategy,
  StrategyPreset,
  StrategyRule,
} from "@/features/automation/types/automation";
import { requireServerEnv } from "@/lib/env.server";

export interface AutomationStrategiesStore {
  list(): Promise<Strategy[]>;
  get(id: string): Promise<Strategy | null>;
  create(input: {
    name?: string;
    preset?: string;
    rule?: unknown;
    enabled?: boolean;
  }): Promise<Strategy>;
  update(id: string, patch: Partial<Strategy>): Promise<Strategy | null>;
  remove(id: string): Promise<boolean>;
}

// ─── Row <-> domain mapping ──────────────────────────────────────────────

interface AutomationStrategyRow {
  id: string;
  name: string;
  preset: string;
  rule: StrategyRule;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

function mapStrategy(row: AutomationStrategyRow): Strategy {
  return {
    id: row.id,
    name: row.name,
    preset: row.preset as StrategyPreset,
    rule: row.rule,
    enabled: row.enabled,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
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

/** Test-only: force a fresh client on next use. */
export function resetSupabaseStrategiesClientForTests(): void {
  cachedClient = null;
}

export class SupabaseAutomationStrategiesStore
  implements AutomationStrategiesStore
{
  async list(): Promise<Strategy[]> {
    const { data, error } = await getClient()
      .from("automation_strategies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as AutomationStrategyRow[]).map(mapStrategy);
  }

  async get(id: string): Promise<Strategy | null> {
    const { data, error } = await getClient()
      .from("automation_strategies")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? mapStrategy(data as AutomationStrategyRow) : null;
  }

  async create(input: {
    name?: string;
    preset?: string;
    rule?: unknown;
    enabled?: boolean;
  }): Promise<Strategy> {
    const preset = (input.preset ?? "balanced") as StrategyPreset;
    const rule = (input.rule ?? PRESET_RULES.balanced) as StrategyRule;
    const { data, error } = await getClient()
      .from("automation_strategies")
      .insert({
        name: input.name ?? "Unnamed",
        preset,
        rule,
        enabled: input.enabled ?? false,
      })
      .select("*")
      .single();
    if (error) throw error;
    return mapStrategy(data as AutomationStrategyRow);
  }

  async update(
    id: string,
    patch: Partial<Strategy>
  ): Promise<Strategy | null> {
    const row: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.preset !== undefined) row.preset = patch.preset;
    if (patch.rule !== undefined) row.rule = patch.rule;
    if (patch.enabled !== undefined) row.enabled = patch.enabled;

    const { data, error } = await getClient()
      .from("automation_strategies")
      .update(row)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? mapStrategy(data as AutomationStrategyRow) : null;
  }

  async remove(id: string): Promise<boolean> {
    const { data, error } = await getClient()
      .from("automation_strategies")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return data !== null;
  }
}

let cachedStore: AutomationStrategiesStore | null = null;

export function getAutomationStrategiesStore(): AutomationStrategiesStore {
  if (!cachedStore) {
    cachedStore = new SupabaseAutomationStrategiesStore();
  }
  return cachedStore;
}
