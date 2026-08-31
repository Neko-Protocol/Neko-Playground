import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireServerEnv } from "@/lib/env.server";
import type {
  Strategy,
  StrategyPreset,
  StrategyRule,
} from "@/features/automation/types/automation";

export interface AutomationStrategiesStore {
  listStrategies(): Promise<Strategy[]>;
  getStrategy(id: string): Promise<Strategy | null>;
  createStrategy(strategy: Strategy): Promise<Strategy>;
  updateStrategy(
    id: string,
    updates: Partial<Omit<Strategy, "id" | "createdAt">>
  ): Promise<Strategy | null>;
  deleteStrategy(id: string): Promise<boolean>;
}

export interface AutomationStrategyRow {
  id: string;
  name: string;
  preset: string;
  rule: Record<string, unknown>;
  enabled: boolean;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToStrategy(row: AutomationStrategyRow): Strategy {
  return {
    id: row.id,
    name: row.name,
    preset: row.preset as StrategyPreset,
    rule: row.rule as unknown as StrategyRule,
    enabled: row.enabled,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    lastRunAt: row.last_run_at
      ? new Date(row.last_run_at).getTime()
      : undefined,
  };
}

let cachedClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
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

export class SupabaseAutomationStrategiesStore implements AutomationStrategiesStore {
  constructor(private readonly client?: SupabaseClient) {}

  private getClient(): SupabaseClient {
    return this.client ?? getSupabaseClient();
  }

  async listStrategies(): Promise<Strategy[]> {
    const { data, error } = await this.getClient()
      .from("automation_strategies")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as AutomationStrategyRow[]).map(mapRowToStrategy);
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    const { data, error } = await this.getClient()
      .from("automation_strategies")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToStrategy(data as AutomationStrategyRow) : null;
  }

  async createStrategy(strategy: Strategy): Promise<Strategy> {
    const { error } = await this.getClient()
      .from("automation_strategies")
      .insert({
        id: strategy.id,
        name: strategy.name,
        preset: strategy.preset,
        rule: strategy.rule as unknown as Record<string, unknown>,
        enabled: strategy.enabled,
        last_run_at: strategy.lastRunAt
          ? new Date(strategy.lastRunAt).toISOString()
          : null,
        created_at: new Date(strategy.createdAt ?? Date.now()).toISOString(),
        updated_at: new Date(strategy.updatedAt ?? Date.now()).toISOString(),
      });

    if (error) throw error;
    return strategy;
  }

  async updateStrategy(
    id: string,
    updates: Partial<Omit<Strategy, "id" | "createdAt">>
  ): Promise<Strategy | null> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.preset !== undefined) patch.preset = updates.preset;
    if (updates.rule !== undefined) patch.rule = updates.rule;
    if (updates.enabled !== undefined) patch.enabled = updates.enabled;
    if (updates.lastRunAt !== undefined) {
      patch.last_run_at = updates.lastRunAt
        ? new Date(updates.lastRunAt).toISOString()
        : null;
    }

    const { data, error } = await this.getClient()
      .from("automation_strategies")
      .update(patch)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw error;
    return data ? mapRowToStrategy(data as AutomationStrategyRow) : null;
  }

  async deleteStrategy(id: string): Promise<boolean> {
    const { error } = await this.getClient()
      .from("automation_strategies")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  }
}

export class InMemoryAutomationStrategiesStore implements AutomationStrategiesStore {
  private store = new Map<string, Strategy>();

  async listStrategies(): Promise<Strategy[]> {
    return [...this.store.values()].map((s) => structuredClone(s));
  }

  async getStrategy(id: string): Promise<Strategy | null> {
    const s = this.store.get(id);
    return s ? structuredClone(s) : null;
  }

  async createStrategy(strategy: Strategy): Promise<Strategy> {
    this.store.set(strategy.id, structuredClone(strategy));
    return structuredClone(strategy);
  }

  async updateStrategy(
    id: string,
    updates: Partial<Omit<Strategy, "id" | "createdAt">>
  ): Promise<Strategy | null> {
    const existing = this.store.get(id);
    if (!existing) return null;
    const updated: Strategy = {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
    this.store.set(id, updated);
    return structuredClone(updated);
  }

  async deleteStrategy(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}

let sharedStore: AutomationStrategiesStore | null = null;

export function getAutomationStrategiesStore(): AutomationStrategiesStore {
  sharedStore ??= new SupabaseAutomationStrategiesStore();
  return sharedStore;
}

export function setAutomationStrategiesStoreForTests(
  store: AutomationStrategiesStore | null
): void {
  sharedStore = store;
}
