import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InMemoryAutomationStrategiesStore,
  SupabaseAutomationStrategiesStore,
  getAutomationStrategiesStore,
  setAutomationStrategiesStoreForTests,
} from "../strategiesStore";
import type { Strategy } from "@/features/automation/types/automation";

describe("InMemoryAutomationStrategiesStore", () => {
  let store: InMemoryAutomationStrategiesStore;

  const sampleStrategy: Strategy = {
    id: "strat-1",
    name: "Balanced Yield",
    preset: "balanced",
    rule: {
      minApySpreadBps: 50,
      maxAllocationPct: 30,
      rebalanceCooldownHours: 12,
    },
    enabled: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    lastRunAt: 1700000000000,
  };

  beforeEach(() => {
    store = new InMemoryAutomationStrategiesStore();
  });

  it("creates and retrieves a strategy", async () => {
    const created = await store.createStrategy(sampleStrategy);
    expect(created).toEqual(sampleStrategy);

    const retrieved = await store.getStrategy("strat-1");
    expect(retrieved).toEqual(sampleStrategy);
  });

  it("lists all stored strategies", async () => {
    await store.createStrategy(sampleStrategy);
    await store.createStrategy({
      ...sampleStrategy,
      id: "strat-2",
      name: "Aggressive Growth",
    });

    const list = await store.listStrategies();
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.id)).toEqual(["strat-1", "strat-2"]);
  });

  it("returns null when getting a non-existent strategy", async () => {
    const retrieved = await store.getStrategy("non-existent");
    expect(retrieved).toBeNull();
  });

  it("updates an existing strategy", async () => {
    await store.createStrategy(sampleStrategy);
    const updated = await store.updateStrategy("strat-1", {
      name: "Updated Name",
      enabled: false,
    });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Updated Name");
    expect(updated?.enabled).toBe(false);
    expect(updated?.preset).toBe("balanced");

    const fetched = await store.getStrategy("strat-1");
    expect(fetched?.name).toBe("Updated Name");
    expect(fetched?.enabled).toBe(false);
  });

  it("returns null when updating a non-existent strategy", async () => {
    const updated = await store.updateStrategy("non-existent", {
      name: "Foo",
    });
    expect(updated).toBeNull();
  });

  it("deletes an existing strategy", async () => {
    await store.createStrategy(sampleStrategy);
    const deleted = await store.deleteStrategy("strat-1");
    expect(deleted).toBe(true);

    const fetched = await store.getStrategy("strat-1");
    expect(fetched).toBeNull();
  });

  it("returns false when deleting a non-existent strategy", async () => {
    const deleted = await store.deleteStrategy("non-existent");
    expect(deleted).toBe(false);
  });
});

describe("SupabaseAutomationStrategiesStore", () => {
  const sampleStrategy: Strategy = {
    id: "strat-1",
    name: "Balanced Yield",
    preset: "balanced",
    rule: {
      minApySpreadBps: 50,
      maxAllocationPct: 30,
      rebalanceCooldownHours: 12,
    },
    enabled: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    lastRunAt: 1700000000000,
  };

  const sampleRow = {
    id: "strat-1",
    name: "Balanced Yield",
    preset: "balanced",
    rule: {
      minApySpreadBps: 50,
      maxAllocationPct: 30,
      rebalanceCooldownHours: 12,
    },
    enabled: true,
    last_run_at: new Date(1700000000000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it("lists strategies from Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [sampleRow],
            error: null,
          }),
        }),
      }),
    };

    const store = new SupabaseAutomationStrategiesStore(fakeClient as any);
    const list = await store.listStrategies();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("strat-1");
    expect(list[0].name).toBe("Balanced Yield");
    expect(list[0].enabled).toBe(true);
    expect(list[0].lastRunAt).toBe(1700000000000);
  });

  it("gets a strategy by id from Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: sampleRow,
              error: null,
            }),
          }),
        }),
      }),
    };

    const store = new SupabaseAutomationStrategiesStore(fakeClient as any);
    const strategy = await store.getStrategy("strat-1");

    expect(strategy).not.toBeNull();
    expect(strategy?.id).toBe("strat-1");
  });

  it("creates a strategy in Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    };

    const store = new SupabaseAutomationStrategiesStore(fakeClient as any);
    const created = await store.createStrategy(sampleStrategy);

    expect(created).toEqual(sampleStrategy);
    expect(fakeClient.from).toHaveBeenCalledWith("automation_strategies");
  });

  it("updates a strategy in Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...sampleRow, name: "Updated" },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const store = new SupabaseAutomationStrategiesStore(fakeClient as any);
    const updated = await store.updateStrategy("strat-1", { name: "Updated" });

    expect(updated).not.toBeNull();
    expect(updated?.name).toBe("Updated");
  });

  it("deletes a strategy in Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      }),
    };

    const store = new SupabaseAutomationStrategiesStore(fakeClient as any);
    const deleted = await store.deleteStrategy("strat-1");

    expect(deleted).toBe(true);
  });
});

describe("getAutomationStrategiesStore / setAutomationStrategiesStoreForTests", () => {
  beforeEach(() => {
    setAutomationStrategiesStoreForTests(null);
  });

  it("allows test override via setAutomationStrategiesStoreForTests", () => {
    const testStore = new InMemoryAutomationStrategiesStore();
    setAutomationStrategiesStoreForTests(testStore);

    expect(getAutomationStrategiesStore()).toBe(testStore);
  });
});
