import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PRESET_RULES } from "@/features/automation/const/automation";

type Row = Record<string, unknown>;

/**
 * Minimal thenable query builder covering the chains SupabaseStrategiesStore
 * actually uses against `automation_strategies`.
 */
const { fakeClient, resetFakeTables } = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {
    automation_strategies: [],
  };

  class FakeQueryBuilder implements PromiseLike<{
    data: unknown;
    error: null;
  }> {
    private filters: Array<(row: Row) => boolean> = [];
    private orderBy: { col: string; ascending: boolean } | null = null;
    private mode: "select" | "insert" | "update" | "delete" = "select";
    private payload: Row | null = null;
    private singleFlag = false;
    private maybeSingleFlag = false;

    constructor(
      private readonly dbTables: Record<string, Row[]>,
      private readonly table: string
    ) {}

    select(_cols?: string): this {
      // After insert/update/delete, `.select()` means "return affected rows",
      // not "switch to read mode".
      return this;
    }

    insert(row: Row): this {
      this.mode = "insert";
      this.payload = row;
      return this;
    }

    update(row: Row): this {
      this.mode = "update";
      this.payload = row;
      return this;
    }

    delete(): this {
      this.mode = "delete";
      return this;
    }

    eq(col: string, value: unknown): this {
      this.filters.push((row) => row[col] === value);
      return this;
    }

    order(col: string, opts?: { ascending?: boolean }): this {
      this.orderBy = { col, ascending: opts?.ascending ?? true };
      return this;
    }

    single(): this {
      this.singleFlag = true;
      return this;
    }

    maybeSingle(): this {
      this.maybeSingleFlag = true;
      return this;
    }

    private materialize(): { data: unknown; error: null } {
      const table =
        this.dbTables[this.table] ?? (this.dbTables[this.table] = []);

      if (this.mode === "insert") {
        const inserted = structuredClone(this.payload as Row);
        table.push(inserted);
        return {
          data: this.singleFlag
            ? structuredClone(inserted)
            : [structuredClone(inserted)],
          error: null,
        };
      }

      let matched = table.filter((row) => this.filters.every((f) => f(row)));

      if (this.mode === "update") {
        const patch = this.payload as Row;
        matched.forEach((row) => Object.assign(row, patch));
        if (this.maybeSingleFlag || this.singleFlag) {
          return {
            data: matched[0] != null ? structuredClone(matched[0]) : null,
            error: null,
          };
        }
        return { data: structuredClone(matched), error: null };
      }

      if (this.mode === "delete") {
        const deleted = matched.map((row) => structuredClone(row));
        const remaining = table.filter(
          (row) => !this.filters.every((f) => f(row))
        );
        table.length = 0;
        table.push(...remaining);
        return { data: deleted, error: null };
      }

      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        matched = [...matched].sort((a, b) => {
          const av = a[col] as string | number;
          const bv = b[col] as string | number;
          if (av === bv) return 0;
          return ascending ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
        });
      }

      if (this.maybeSingleFlag || this.singleFlag) {
        return {
          data: matched[0] != null ? structuredClone(matched[0]) : null,
          error: null,
        };
      }
      return { data: structuredClone(matched), error: null };
    }

    then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
      onfulfilled?:
        | ((value: {
            data: unknown;
            error: null;
          }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): PromiseLike<TResult1 | TResult2> {
      return Promise.resolve(this.materialize()).then(onfulfilled, onrejected);
    }
  }

  function resetFakeTables() {
    tables.automation_strategies.length = 0;
  }

  const fakeClient = {
    from(table: string) {
      return new FakeQueryBuilder(tables, table);
    },
  };

  return { fakeClient, resetFakeTables };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => fakeClient,
}));

vi.mock("@/lib/env.server", () => ({
  requireServerEnv: () => ({
    SUPABASE_URL: "http://fake",
    SUPABASE_SERVICE_ROLE_KEY: "fake-key",
  }),
}));

import { SupabaseStrategiesStore } from "../strategiesStore";

const T0 = 1_700_000_000_000;

function createInput(
  overrides: Partial<{
    name: string;
    preset: "conservative" | "balanced" | "aggressive" | "custom";
    rule: (typeof PRESET_RULES)["conservative"];
    enabled: boolean;
  }> = {}
) {
  return {
    name: "Test Strategy",
    preset: "conservative" as const,
    rule: PRESET_RULES.conservative,
    enabled: false,
    ...overrides,
  };
}

describe("SupabaseStrategiesStore", () => {
  beforeEach(() => {
    resetFakeTables();
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("create assigns an id and sets createdAt === updatedAt with all input fields", async () => {
    const store = new SupabaseStrategiesStore();
    const input = createInput({
      name: "Alpha",
      preset: "balanced",
      rule: PRESET_RULES.balanced,
      enabled: true,
    });

    const created = await store.create(input);

    expect(created.id).toEqual(expect.any(String));
    expect(created.id.length).toBeGreaterThan(0);
    expect(created.createdAt).toBe(T0);
    expect(created.updatedAt).toBe(T0);
    expect(created.createdAt).toBe(created.updatedAt);
    expect(created.name).toBe("Alpha");
    expect(created.preset).toBe("balanced");
    expect(created.rule).toEqual(PRESET_RULES.balanced);
    expect(created.enabled).toBe(true);
  });

  it("get returns null for an unknown id and the created Strategy for a known id", async () => {
    const store = new SupabaseStrategiesStore();
    expect(await store.get("does-not-exist")).toBeNull();

    const created = await store.create(createInput({ name: "Known" }));
    const fetched = await store.get(created.id);
    expect(fetched).toEqual(created);
  });

  it("list returns all strategies ordered newest-first by createdAt", async () => {
    const store = new SupabaseStrategiesStore();

    vi.setSystemTime(T0);
    const oldest = await store.create(createInput({ name: "Oldest" }));
    vi.setSystemTime(T0 + 1_000);
    const middle = await store.create(createInput({ name: "Middle" }));
    vi.setSystemTime(T0 + 2_000);
    const newest = await store.create(createInput({ name: "Newest" }));

    const listed = await store.list();
    expect(listed.map((s) => s.id)).toEqual([newest.id, middle.id, oldest.id]);
    expect(listed.map((s) => s.name)).toEqual(["Newest", "Middle", "Oldest"]);
  });

  it("update on an unknown id returns null without throwing", async () => {
    const store = new SupabaseStrategiesStore();
    await expect(
      store.update("missing-id", { enabled: true })
    ).resolves.toBeNull();
  });

  it("update with a partial patch leaves other fields untouched and bumps updatedAt", async () => {
    const store = new SupabaseStrategiesStore();
    const created = await store.create(
      createInput({
        name: "Partial",
        preset: "aggressive",
        rule: PRESET_RULES.aggressive,
        enabled: false,
      })
    );

    vi.setSystemTime(T0 + 5_000);
    const updated = await store.update(created.id, { enabled: true });

    expect(updated).not.toBeNull();
    expect(updated!.enabled).toBe(true);
    expect(updated!.name).toBe("Partial");
    expect(updated!.preset).toBe("aggressive");
    expect(updated!.rule).toEqual(PRESET_RULES.aggressive);
    expect(updated!.createdAt).toBe(T0);
    expect(updated!.updatedAt).toBe(T0 + 5_000);
    expect(updated!.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(updated!.updatedAt).toBeGreaterThan(created.createdAt);
  });

  it("remove returns true for a known id and false for an unknown id", async () => {
    const store = new SupabaseStrategiesStore();
    const created = await store.create(createInput({ name: "ToRemove" }));

    expect(await store.remove(created.id)).toBe(true);
    expect(await store.get(created.id)).toBeNull();

    await expect(store.remove("never-existed")).resolves.toBe(false);
  });

  it("a strategy created via one store instance is visible to another instance", async () => {
    const storeA = new SupabaseStrategiesStore();
    const storeB = new SupabaseStrategiesStore();

    const created = await storeA.create(
      createInput({ name: "CrossInstance", enabled: true })
    );

    const listed = await storeB.list();
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(created);

    const fetched = await storeB.get(created.id);
    expect(fetched).toEqual(created);
  });

  it("concurrent creates persist all distinct strategies without corruption", async () => {
    const store = new SupabaseStrategiesStore();
    const count = 15;

    const created = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        store.create(createInput({ name: `Concurrent-${i}` }))
      )
    );

    const listed = await store.list();
    expect(listed).toHaveLength(count);

    const ids = listed.map((s) => s.id);
    expect(new Set(ids).size).toBe(count);

    const names = new Set(listed.map((s) => s.name));
    expect(names.size).toBe(count);
    for (let i = 0; i < count; i++) {
      expect(names.has(`Concurrent-${i}`)).toBe(true);
    }

    for (const strategy of created) {
      const match = listed.find((s) => s.id === strategy.id);
      expect(match).toEqual(strategy);
      expect(match!.name).toBe(strategy.name);
      expect(match!.preset).toBe(strategy.preset);
      expect(match!.rule).toEqual(strategy.rule);
      expect(match!.enabled).toBe(strategy.enabled);
    }
  });
});
