import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { CoordinatorRun, DelegationGrant } from "../types";

type Row = Record<string, unknown>;

/**
 * Minimal thenable query builder for SupabaseCoordinatorLedgerStore.
 * Upsert replaces the full existing row on conflict (no field merge), matching
 * Postgres ON CONFLICT DO UPDATE SET … of every column.
 */
const { fakeClient, resetFakeTables } = vi.hoisted(() => {
  const tables: Record<string, Row[]> = {
    coordinator_delegation_grants: [],
    coordinator_runs: [],
  };

  class FakeQueryBuilder implements PromiseLike<{
    data: unknown;
    error: null;
  }> {
    private filters: Array<(row: Row) => boolean> = [];
    private orderBy: { col: string; ascending: boolean } | null = null;
    private limitN: number | null = null;
    private mode: "select" | "upsert" = "select";
    private payload: Row | null = null;
    private onConflictCols: string[] | null = null;
    private maybeSingleFlag = false;

    constructor(
      private readonly dbTables: Record<string, Row[]>,
      private readonly table: string
    ) {}

    select(_cols?: string): this {
      return this;
    }

    upsert(row: Row, opts?: { onConflict?: string }): this {
      this.mode = "upsert";
      this.payload = row;
      this.onConflictCols =
        opts?.onConflict?.split(",").map((c) => c.trim()) ?? null;
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

    limit(n: number): this {
      this.limitN = n;
      return this;
    }

    maybeSingle(): this {
      this.maybeSingleFlag = true;
      return this;
    }

    private materialize(): { data: unknown; error: null } {
      const table =
        this.dbTables[this.table] ?? (this.dbTables[this.table] = []);

      if (this.mode === "upsert") {
        const row = structuredClone(this.payload as Row);
        const keyCols = this.onConflictCols ?? Object.keys(row);
        const existingIdx = table.findIndex((r) =>
          keyCols.every((c) => r[c] === row[c])
        );
        if (existingIdx >= 0) {
          // Full-row replace — never merge with the previous row.
          table[existingIdx] = row;
          return { data: structuredClone(row), error: null };
        }
        table.push(row);
        return { data: structuredClone(row), error: null };
      }

      let matched = table.filter((row) => this.filters.every((f) => f(row)));

      if (this.orderBy) {
        const { col, ascending } = this.orderBy;
        matched = [...matched].sort((a, b) => {
          const av = a[col] as string | number;
          const bv = b[col] as string | number;
          if (av === bv) return 0;
          return ascending ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
        });
      }
      if (this.limitN !== null) matched = matched.slice(0, this.limitN);

      if (this.maybeSingleFlag) {
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
    tables.coordinator_delegation_grants.length = 0;
    tables.coordinator_runs.length = 0;
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

import {
  FileCoordinatorLedgerStore,
  InMemoryCoordinatorLedgerStore,
  SupabaseCoordinatorLedgerStore,
  type CoordinatorLedgerStore,
} from "../ledger";

function makeGrant(overrides: Partial<DelegationGrant> = {}): DelegationGrant {
  return {
    id: "grant-1",
    positionId: "pos-1",
    walletAddress: "GUSERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    assetCode: "USTRY",
    borrowAssetCode: "USDC",
    status: "active",
    createdAt: 1_700_000_000_000,
    expiresAt: 1_800_000_000_000,
    tranches: [
      {
        id: "t0",
        order: 0,
        collateralAmount: "100.5",
        debtAmount: "50.25",
        collateralPoolId: "blend:CPOOL:CUSTRY",
        borrowPoolId: "blend:CPOOL:CUSDC",
        steps: [
          {
            stepId: "repay-0",
            operationType: "repay",
            protocol: "blend",
            poolType: "blend",
            assetCode: "USDC",
            amount: "50.25",
            submissionMode: "rpc",
            signedXdr: "AAAA...repay",
            networkPassphrase: "Test SDF Network ; September 2015",
          },
          {
            stepId: "withdraw-0",
            operationType: "withdrawCollateral",
            protocol: "blend",
            poolType: "blend",
            assetCode: "USTRY",
            amount: "100.5",
            submissionMode: "rpc",
            signedXdr: "AAAA...withdraw",
            networkPassphrase: "Test SDF Network ; September 2015",
          },
        ],
      },
      {
        id: "t1",
        order: 1,
        collateralAmount: "80",
        debtAmount: "40",
        collateralPoolId: "blend:CPOOL:CUSTRY",
        borrowPoolId: "blend:CPOOL:CUSDC",
        steps: [
          {
            stepId: "repay-1",
            operationType: "repay",
            protocol: "blend",
            poolType: "blend",
            assetCode: "USDC",
            amount: "40",
            submissionMode: "soroswapApi",
            signedXdr: "AAAA...repay1",
            networkPassphrase: "Test SDF Network ; September 2015",
          },
        ],
      },
    ],
    consumedTrancheIds: ["t0"],
    guardConfig: { deleverageThreshold: 1.15, hysteresis: 0.05 },
    breached: true,
    ...overrides,
  };
}

function makeRun(overrides: Partial<CoordinatorRun> = {}): CoordinatorRun {
  return {
    id: "run-1",
    positionId: "pos-1",
    grantId: "grant-1",
    reason: "deleverage-guard",
    triggeredAt: 1_700_000_100_000,
    updatedAt: 1_700_000_200_000,
    status: "in_progress",
    healthFactorAtTrigger: 1.12,
    healthFactorTarget: 1.2,
    trancheIdsPlanned: ["t0", "t1"],
    steps: [
      {
        idempotencyKey: "run-1:t0:repay-0",
        trancheId: "t0",
        stepId: "repay-0",
        status: "completed",
        txHash: "abc123",
        submittedAt: 1_700_000_150_000,
        confirmedAt: 1_700_000_160_000,
      },
      {
        idempotencyKey: "run-1:t0:withdraw-0",
        trancheId: "t0",
        stepId: "withdraw-0",
        status: "pending",
      },
    ],
    ...overrides,
  };
}

function runContractTests(
  name: string,
  makeStore: () => CoordinatorLedgerStore
) {
  describe(name, () => {
    it("getGrant returns null for an unknown positionId", async () => {
      const store = makeStore();
      expect(await store.getGrant("does-not-exist")).toBeNull();
    });

    it("saveGrant then getGrant round-trips a full DelegationGrant", async () => {
      const store = makeStore();
      const grant = makeGrant({
        revokedAt: 1_700_000_050_000,
        status: "revoked",
      });
      await store.saveGrant(grant);
      expect(await store.getGrant(grant.positionId)).toEqual(grant);
    });

    it("saveGrant twice for the same positionId keeps only the latest write", async () => {
      const store = makeStore();
      const first = makeGrant({
        positionId: "pos-dup",
        id: "grant-old",
        breached: false,
        consumedTrancheIds: [],
        guardConfig: { deleverageThreshold: 1.1, hysteresis: 0.02 },
      });
      const second = makeGrant({
        positionId: "pos-dup",
        id: "grant-new",
        breached: true,
        walletAddress: "GOTHERADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        consumedTrancheIds: ["t0", "t1"],
        guardConfig: { deleverageThreshold: 1.25, hysteresis: 0.08 },
        assetCode: "XLM",
      });
      await store.saveGrant(first);
      await store.saveGrant(second);
      expect(await store.getGrant("pos-dup")).toEqual(second);
    });

    it("listActiveGrants returns only status: active grants", async () => {
      const store = makeStore();
      const active = makeGrant({ positionId: "pos-active", id: "g-active" });
      const revoked = makeGrant({
        positionId: "pos-revoked",
        id: "g-revoked",
        status: "revoked",
        revokedAt: 1_700_000_050_000,
      });
      await store.saveGrant(active);
      await store.saveGrant(revoked);

      const listed = await store.listActiveGrants();
      expect(listed).toHaveLength(1);
      expect(listed[0]).toEqual(active);
    });

    it("saveRun then getRun round-trips a full CoordinatorRun including steps", async () => {
      const store = makeStore();
      const run = makeRun({
        completedAt: 1_700_000_300_000,
        status: "completed",
        healthFactorAtTrigger: null,
      });
      await store.saveRun(run);
      expect(await store.getRun(run.id)).toEqual(run);
    });

    it("findInProgressRunForPosition returns the in_progress run or null", async () => {
      const store = makeStore();
      expect(await store.findInProgressRunForPosition("pos-1")).toBeNull();

      const done = makeRun({
        id: "run-done",
        positionId: "pos-1",
        status: "completed",
        completedAt: 1_700_000_400_000,
      });
      const failed = makeRun({
        id: "run-failed",
        positionId: "pos-1",
        status: "failed",
        triggeredAt: 1_700_000_050_000,
      });
      await store.saveRun(done);
      await store.saveRun(failed);
      expect(await store.findInProgressRunForPosition("pos-1")).toBeNull();

      const inProgress = makeRun({
        id: "run-live",
        positionId: "pos-1",
        status: "in_progress",
        triggeredAt: 1_700_000_500_000,
      });
      await store.saveRun(inProgress);
      expect(await store.findInProgressRunForPosition("pos-1")).toEqual(
        inProgress
      );
    });

    it("listRunsForPosition returns only runs for that position", async () => {
      const store = makeStore();
      const a1 = makeRun({ id: "run-a1", positionId: "pos-a" });
      const a2 = makeRun({
        id: "run-a2",
        positionId: "pos-a",
        status: "completed",
        triggeredAt: 1_700_000_050_000,
      });
      const b1 = makeRun({ id: "run-b1", positionId: "pos-b" });
      await store.saveRun(a1);
      await store.saveRun(a2);
      await store.saveRun(b1);

      const forA = await store.listRunsForPosition("pos-a");
      expect(forA).toHaveLength(2);
      expect(forA.map((r) => r.id).sort()).toEqual(["run-a1", "run-a2"]);
      expect(forA.every((r) => r.positionId === "pos-a")).toBe(true);

      const forB = await store.listRunsForPosition("pos-b");
      expect(forB).toHaveLength(1);
      expect(forB[0]).toEqual(b1);
    });
  });
}

describe("FileCoordinatorLedgerStore", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "coordinator-ledger-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  runContractTests("contract", () => new FileCoordinatorLedgerStore(tmpDir));
});

describe("InMemoryCoordinatorLedgerStore", () => {
  runContractTests("contract", () => new InMemoryCoordinatorLedgerStore());
});

describe("SupabaseCoordinatorLedgerStore", () => {
  beforeEach(() => {
    resetFakeTables();
  });

  runContractTests("contract", () => new SupabaseCoordinatorLedgerStore());

  describe("concurrency", () => {
    it("concurrent saveGrant for distinct positionIds keeps every row intact", async () => {
      const store = new SupabaseCoordinatorLedgerStore();
      const grants = Array.from({ length: 20 }, (_, i) =>
        makeGrant({
          id: `grant-c-${i}`,
          positionId: `pos-c-${i}`,
          walletAddress: `GWALLET${i.toString().padStart(48, "0")}`,
          assetCode: i % 2 === 0 ? "USTRY" : "XLM",
          breached: i % 3 === 0,
          consumedTrancheIds: i % 2 === 0 ? ["t0"] : [],
          guardConfig: {
            deleverageThreshold: 1.1 + i * 0.01,
            hysteresis: 0.01 + i * 0.001,
          },
          createdAt: 1_700_000_000_000 + i,
        })
      );

      await Promise.all(grants.map((g) => store.saveGrant(g)));

      for (const grant of grants) {
        expect(await store.getGrant(grant.positionId)).toEqual(grant);
      }
    });

    it("concurrent saveRun for distinct run ids keeps every row intact", async () => {
      const store = new SupabaseCoordinatorLedgerStore();
      const runs = Array.from({ length: 20 }, (_, i) =>
        makeRun({
          id: `run-c-${i}`,
          positionId: `pos-run-${i}`,
          grantId: `grant-run-${i}`,
          healthFactorAtTrigger: 1.0 + i * 0.01,
          healthFactorTarget: 1.2 + i * 0.01,
          trancheIdsPlanned: [`t-${i}`],
          triggeredAt: 1_700_000_100_000 + i,
          updatedAt: 1_700_000_200_000 + i,
          status: i % 2 === 0 ? "in_progress" : "completed",
          steps: [
            {
              idempotencyKey: `run-c-${i}:t-${i}:step`,
              trancheId: `t-${i}`,
              stepId: `step-${i}`,
              status: "pending",
            },
          ],
        })
      );

      await Promise.all(runs.map((r) => store.saveRun(r)));

      for (const run of runs) {
        expect(await store.getRun(run.id)).toEqual(run);
      }
    });

    it("same-key concurrent saveGrant yields exactly one full fixture, never a hybrid", async () => {
      const store = new SupabaseCoordinatorLedgerStore();
      const positionId = "pos-same-key";
      const fixtureA = makeGrant({
        positionId,
        id: "grant-A",
        walletAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        assetCode: "USTRY",
        borrowAssetCode: "USDC",
        breached: true,
        consumedTrancheIds: ["t0"],
        guardConfig: { deleverageThreshold: 1.11, hysteresis: 0.03 },
        createdAt: 1_700_000_000_001,
        expiresAt: 1_800_000_000_001,
      });
      const fixtureB = makeGrant({
        positionId,
        id: "grant-B",
        walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        assetCode: "XLM",
        borrowAssetCode: "EURC",
        breached: false,
        consumedTrancheIds: ["t0", "t1"],
        guardConfig: { deleverageThreshold: 1.33, hysteresis: 0.09 },
        createdAt: 1_700_000_000_002,
        expiresAt: 1_800_000_000_002,
        status: "revoked",
        revokedAt: 1_700_000_000_099,
      });

      await Promise.all([store.saveGrant(fixtureA), store.saveGrant(fixtureB)]);

      // Full-row upsert: final value must equal one fixture entirely (deep
      // equality), never a field-level mix of A and B.
      const final = await store.getGrant(positionId);
      expect([fixtureA, fixtureB]).toContainEqual(final);
    });
  });
});
