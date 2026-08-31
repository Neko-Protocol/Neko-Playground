import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InMemoryCoordinatorLedgerStore,
  SupabaseCoordinatorLedgerStore,
  getCoordinatorLedgerStore,
  setCoordinatorLedgerStoreForTests,
} from "../ledger";
import type { DelegationGrant, CoordinatorRun } from "../types";

describe("InMemoryCoordinatorLedgerStore", () => {
  let store: InMemoryCoordinatorLedgerStore;

  const sampleGrant: DelegationGrant = {
    id: "grant-1",
    positionId: "pos-1",
    walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    assetCode: "USDC",
    borrowAssetCode: "XLM",
    status: "active",
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    tranches: [
      {
        id: "tranche-1",
        order: 0,
        collateralAmount: "1000",
        debtAmount: "1000",
        collateralPoolId: "pool-1",
        borrowPoolId: "pool-2",
        steps: [],
      },
    ],
    consumedTrancheIds: [],
    guardConfig: {
      deleverageThreshold: 1.1,
      hysteresis: 0.1,
    },
    breached: false,
  };

  const sampleRun: CoordinatorRun = {
    id: "run-1",
    positionId: "pos-1",
    grantId: "grant-1",
    reason: "deleverage-guard",
    status: "in_progress",
    healthFactorAtTrigger: 1.05,
    healthFactorTarget: 1.5,
    trancheIdsPlanned: ["tranche-1"],
    steps: [],
    triggeredAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    store = new InMemoryCoordinatorLedgerStore();
  });

  it("saves and retrieves a grant", async () => {
    await store.saveGrant(sampleGrant);
    const retrieved = await store.getGrant("pos-1");
    expect(retrieved).toEqual(sampleGrant);
  });

  it("returns null for non-existent grant", async () => {
    const retrieved = await store.getGrant("pos-unknown");
    expect(retrieved).toBeNull();
  });

  it("lists active non-expired grants", async () => {
    await store.saveGrant(sampleGrant);
    await store.saveGrant({
      ...sampleGrant,
      id: "grant-2",
      positionId: "pos-2",
      status: "revoked",
    });
    await store.saveGrant({
      ...sampleGrant,
      id: "grant-3",
      positionId: "pos-3",
      expiresAt: Date.now() - 1000, // expired
    });

    const active = await store.listActiveGrants();
    expect(active).toHaveLength(1);
    expect(active[0].positionId).toBe("pos-1");
  });

  it("saves and retrieves a run", async () => {
    await store.saveRun(sampleRun);
    const retrieved = await store.getRun("run-1");
    expect(retrieved).toEqual(sampleRun);
  });

  it("finds in-progress run for a position", async () => {
    await store.saveRun(sampleRun);
    const found = await store.findInProgressRunForPosition("pos-1");
    expect(found?.id).toBe("run-1");

    // Complete the run
    await store.saveRun({ ...sampleRun, status: "completed" });
    const after = await store.findInProgressRunForPosition("pos-1");
    expect(after).toBeNull();
  });

  it("lists all runs for a position in reverse chronological order", async () => {
    await store.saveRun({
      ...sampleRun,
      id: "run-1",
      triggeredAt: 1000,
    });
    await store.saveRun({
      ...sampleRun,
      id: "run-2",
      triggeredAt: 2000,
    });

    const runs = await store.listRunsForPosition("pos-1");
    expect(runs).toHaveLength(2);
    expect(runs[0].id).toBe("run-2");
    expect(runs[1].id).toBe("run-1");
  });
});

describe("SupabaseCoordinatorLedgerStore", () => {
  const sampleGrant: DelegationGrant = {
    id: "grant-1",
    positionId: "pos-1",
    walletAddress: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    assetCode: "USDC",
    borrowAssetCode: "XLM",
    status: "active",
    createdAt: 1700000000000,
    expiresAt: 1700000000000,
    tranches: [],
    consumedTrancheIds: [],
    guardConfig: {
      deleverageThreshold: 1.1,
      hysteresis: 0.1,
    },
    breached: false,
  };

  const sampleGrantRow = {
    id: "grant-1",
    position_id: "pos-1",
    wallet_address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    asset_code: "USDC",
    borrow_asset_code: "XLM",
    status: "active",
    expires_at: new Date(1700000000000).toISOString(),
    revoked_at: null,
    tranches: [],
    consumed_tranche_ids: [],
    guard_config: {
      deleverageThreshold: 1.1,
      hysteresis: 0.1,
    },
    breached: false,
    created_at: new Date(1700000000000).toISOString(),
    updated_at: new Date(1700000000000).toISOString(),
  };

  const sampleRunRow = {
    id: "run-1",
    position_id: "pos-1",
    grant_id: "grant-1",
    reason: "deleverage-guard",
    status: "in_progress",
    health_factor_at_trigger: 1.05,
    health_factor_target: 1.5,
    tranche_ids_planned: ["tranche-1"],
    steps: [],
    triggered_at: new Date(1700000000000).toISOString(),
    completed_at: null,
    created_at: new Date(1700000000000).toISOString(),
    updated_at: new Date(1700000000000).toISOString(),
  };

  it("gets a grant by positionId from Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: sampleGrantRow,
              error: null,
            }),
          }),
        }),
      }),
    };

    const store = new SupabaseCoordinatorLedgerStore(fakeClient as any);
    const grant = await store.getGrant("pos-1");

    expect(grant).not.toBeNull();
    expect(grant?.id).toBe("grant-1");
    expect(grant?.positionId).toBe("pos-1");
    expect(grant?.expiresAt).toBe(1700000000000);
  });

  it("saves a grant via upsert in Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    };

    const store = new SupabaseCoordinatorLedgerStore(fakeClient as any);
    await store.saveGrant(sampleGrant);

    expect(fakeClient.from).toHaveBeenCalledWith("coordinator_grants");
  });

  it("lists active grants from Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockResolvedValue({
              data: [sampleGrantRow],
              error: null,
            }),
          }),
        }),
      }),
    };

    const store = new SupabaseCoordinatorLedgerStore(fakeClient as any);
    const active = await store.listActiveGrants();

    expect(active).toHaveLength(1);
    expect(active[0].positionId).toBe("pos-1");
  });

  it("finds in-progress run for a position from Supabase", async () => {
    const fakeClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: sampleRunRow,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const store = new SupabaseCoordinatorLedgerStore(fakeClient as any);
    const run = await store.findInProgressRunForPosition("pos-1");

    expect(run).not.toBeNull();
    expect(run?.id).toBe("run-1");
    expect(run?.status).toBe("in_progress");
  });
});

describe("getCoordinatorLedgerStore / setCoordinatorLedgerStoreForTests", () => {
  beforeEach(() => {
    setCoordinatorLedgerStoreForTests(null);
  });

  it("allows test override via setCoordinatorLedgerStoreForTests", () => {
    const testStore = new InMemoryCoordinatorLedgerStore();
    setCoordinatorLedgerStoreForTests(testStore);

    expect(getCoordinatorLedgerStore()).toBe(testStore);
  });
});
