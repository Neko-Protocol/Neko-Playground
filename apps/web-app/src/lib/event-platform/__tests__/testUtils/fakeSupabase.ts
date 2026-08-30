/**
 * An in-memory stand-in for the Supabase client, used by this feature's
 * "integration" tests. It is NOT a Postgres test double in the strict
 * sense — there is no live database available in this environment to test
 * against (see supabase/migrations/0001_event_platform_core.sql's header
 * comment) — but its `fn_raise_platform_event` handler re-implements the
 * exact same decision as the real SQL function, built on the same pure
 * logic (`computeTransition`, `decideCorrelation`) that function was
 * translated from. That makes this genuine coverage of the outbox's
 * decision logic end-to-end, just not of Postgres transaction semantics
 * themselves — run the real migrations against a database and re-verify
 * atomicity/locking behavior there before relying on this alone.
 */
import { computeTransition, type AlertDedupeState } from "../../dedup";
import { decideCorrelation } from "../../correlation";

type Row = Record<string, unknown>;

export interface FakeDb {
  tables: Record<string, Row[]>;
  rpc(
    fn: string,
    args: Record<string, unknown>
  ): Promise<{ data: unknown; error: null | { message: string } }>;
  from(table: string): FakeQueryBuilder;
}

class FakeQueryBuilder implements PromiseLike<{
  data: unknown;
  error: null;
  count?: number;
}> {
  private filters: Array<(row: Row) => boolean> = [];
  private orderBy: { col: string; ascending: boolean } | null = null;
  private limitN: number | null = null;
  private mode: "select" | "insert" | "update" | "upsert" = "select";
  private payload: Row | Row[] | null = null;
  private onConflictCols: string[] | null = null;
  private singleFlag = false;
  private maybeSingleFlag = false;
  private countHead = false;

  constructor(
    private db: FakeDb,
    private table: string
  ) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }): this {
    // Only a read query's `.select()` — chained after `.insert()`/`.update()`/
    // `.upsert()` it means "return the affected row(s)", not "switch to read
    // mode", so it must not clobber the mode those already set.
    if (this.mode === "select") {
      this.countHead = Boolean(opts?.head);
    }
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

  upsert(row: Row, opts?: { onConflict?: string }): this {
    this.mode = "upsert";
    this.payload = row;
    this.onConflictCols = opts?.onConflict?.split(",") ?? null;
    return this;
  }

  eq(col: string, value: unknown): this {
    this.filters.push((row) => row[col] === value);
    return this;
  }

  not(col: string, _op: string, value: unknown): this {
    this.filters.push((row) => row[col] !== value);
    return this;
  }

  in(col: string, values: unknown[]): this {
    this.filters.push((row) => values.includes(row[col]));
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

  single(): this {
    this.singleFlag = true;
    return this;
  }

  maybeSingle(): this {
    this.maybeSingleFlag = true;
    return this;
  }

  private materialize(): { data: unknown; error: null; count?: number } {
    const table =
      this.db.tables[this.table] ?? (this.db.tables[this.table] = []);

    if (this.mode === "insert") {
      const rows = Array.isArray(this.payload)
        ? this.payload
        : [this.payload as Row];
      const inserted = rows.map((r) => ({
        id: r.id ?? cryptoRandomId(),
        ...r,
      }));
      table.push(...inserted);
      return { data: this.singleFlag ? inserted[0] : inserted, error: null };
    }

    if (this.mode === "upsert") {
      const row = this.payload as Row;
      const keyCols = this.onConflictCols ?? Object.keys(row);
      const existingIdx = table.findIndex((r) =>
        keyCols.every((c) => r[c] === row[c])
      );
      if (existingIdx >= 0) {
        table[existingIdx] = { ...table[existingIdx], ...row };
        return {
          data: this.singleFlag ? table[existingIdx] : [table[existingIdx]],
          error: null,
        };
      }
      const inserted = { id: row.id ?? cryptoRandomId(), ...row };
      table.push(inserted);
      return { data: this.singleFlag ? inserted : [inserted], error: null };
    }

    let matched = table.filter((row) => this.filters.every((f) => f(row)));

    if (this.mode === "update") {
      const patch = this.payload as Row;
      matched.forEach((row) => Object.assign(row, patch));
      return { data: this.singleFlag ? matched[0] : matched, error: null };
    }

    if (this.orderBy) {
      const { col, ascending } = this.orderBy;
      matched = [...matched].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        return ascending ? (av > bv ? 1 : -1) : av < bv ? 1 : -1;
      });
    }
    if (this.limitN !== null) matched = matched.slice(0, this.limitN);

    if (this.countHead)
      return { data: null, error: null, count: matched.length };
    if (this.singleFlag) return { data: matched[0] ?? null, error: null };
    if (this.maybeSingleFlag) return { data: matched[0] ?? null, error: null };
    return { data: matched, error: null };
  }

  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: unknown;
          error: null;
          count?: number;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.materialize()).then(onfulfilled, onrejected);
  }
}

function cryptoRandomId(): string {
  return `id_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function createFakeDb(): FakeDb {
  const tables: Record<string, Row[]> = {
    alert_dedupe_state: [],
    platform_events: [],
    incidents: [],
    incident_events: [],
    wallet_auth_challenges: [],
    wallet_sessions: [],
  };

  const db: FakeDb = {
    tables,
    from(table: string) {
      return new FakeQueryBuilder(db, table);
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      switch (fn) {
        case "fn_raise_platform_event":
          return { data: raisePlatformEvent(tables, args), error: null };
        default:
          return { data: null, error: { message: `unknown rpc ${fn}` } };
      }
    },
  };
  return db;
}

function stateRowToState(row: Row | undefined): AlertDedupeState {
  if (!row) {
    return {
      status: "resolved",
      severity: "info",
      cycleCount: 0,
      suppressedUntil: null,
    };
  }
  return {
    status: row.current_status as AlertDedupeState["status"],
    severity: row.severity as AlertDedupeState["severity"],
    cycleCount: row.cycle_count as number,
    suppressedUntil: (row.suppressed_until as number | null) ?? null,
  };
}

/**
 * Mirrors fn_raise_platform_event's dedupe/escalation/correlation decision.
 * The multi-channel enqueue step it also performs in Postgres is left out
 * here — event_deliveries insertion belongs to the queue-draining/
 * multi-channel-delivery work landing in a follow-up PR — but events and
 * incidents are recorded exactly as they would be in the real function.
 */
function raisePlatformEvent(
  tables: Record<string, Row[]>,
  args: Record<string, unknown>
) {
  const source = args.p_source as string;
  const walletAddress = args.p_wallet_address as string;
  const dedupeKey = args.p_dedupe_key as string;
  const now = Date.now();

  const stateRow = tables.alert_dedupe_state.find(
    (r) =>
      r.source === source &&
      r.wallet_address === walletAddress &&
      r.dedupe_key === dedupeKey
  );

  const decision = computeTransition({
    state: stateRowToState(stateRow),
    severity: args.p_severity as "info" | "warning" | "critical",
    isResolution: Boolean(args.p_is_resolution),
    now,
    suppressionWindowMs:
      ((args.p_suppression_window_seconds as number) ?? 300) * 1000,
    escalationCycleThreshold:
      (args.p_escalation_cycle_threshold as number) ?? 3,
  });

  const nextRow = {
    source,
    wallet_address: walletAddress,
    dedupe_key: dedupeKey,
    current_status: decision.nextState.status,
    severity: decision.nextState.severity,
    cycle_count: decision.nextState.cycleCount,
    suppressed_until: decision.nextState.suppressedUntil,
  };
  if (stateRow) Object.assign(stateRow, nextRow);
  else tables.alert_dedupe_state.push(nextRow);

  if (!decision.emit) {
    return { created: false, reason: decision.reason };
  }

  const eventId = cryptoRandomId();
  const event = {
    id: eventId,
    source,
    wallet_address: walletAddress,
    dedupe_key: dedupeKey,
    event_type: args.p_event_type,
    severity: decision.severity,
    payload: args.p_payload ?? {},
    incident_id: null as string | null,
    created_at: new Date(now).toISOString(),
    _createdAtMs: now,
  };
  tables.platform_events.push(event);

  const windowMs =
    ((args.p_correlation_window_seconds as number) ?? 300) * 1000;
  const candidates = tables.platform_events
    .filter((e) => e.wallet_address === walletAddress && e.id !== eventId)
    .map((e) => ({
      id: e.id as string,
      source: e.source as never,
      createdAt: e._createdAtMs as number,
      incidentId: (e.incident_id as string | null) ?? null,
    }));

  const correlation = decideCorrelation(
    { source: source as never, createdAt: now },
    candidates,
    windowMs
  );
  let incidentId: string | null = null;
  if (correlation.attachTo === "existing") {
    incidentId = correlation.incidentId;
  } else if (correlation.attachTo === "new") {
    incidentId = cryptoRandomId();
    tables.incidents.push({
      id: incidentId,
      wallet_address: walletAddress,
      title: `Correlated ${source} activity`,
      severity: decision.severity,
      status: "open",
      created_at: new Date(now).toISOString(),
    });
    tables.incident_events.push({
      incident_id: incidentId,
      event_id: correlation.correlatedEventId,
    });
    const correlatedEvent = tables.platform_events.find(
      (e) => e.id === correlation.correlatedEventId
    );
    if (correlatedEvent) correlatedEvent.incident_id = incidentId;
  }
  if (incidentId) {
    event.incident_id = incidentId;
    tables.incident_events.push({ incident_id: incidentId, event_id: eventId });
  }

  return {
    created: true,
    event_id: eventId,
    incident_id: incidentId,
    escalated: decision.escalated,
  };
}
