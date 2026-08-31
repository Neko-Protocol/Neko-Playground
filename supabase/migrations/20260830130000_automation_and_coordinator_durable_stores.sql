-- Durable stores for automation strategy persistence and the coordinator
-- deleverage-guard ledger. See lib/automation/strategiesStore.ts and
-- lib/coordinator/ledger.ts (SupabaseCoordinatorLedgerStore) in the web-app.

create table public.automation_strategies (
  id text primary key,
  name text not null,
  preset text not null check (preset in ('conservative', 'balanced', 'aggressive', 'custom')),
  rule jsonb not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_run_at timestamptz
);

create table public.coordinator_delegation_grants (
  position_id text primary key,
  id uuid not null default gen_random_uuid(),
  wallet_address text not null,
  asset_code text not null,
  borrow_asset_code text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz not null,
  tranches jsonb not null default '[]'::jsonb,
  consumed_tranche_ids jsonb not null default '[]'::jsonb,
  guard_config jsonb not null,
  breached boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.coordinator_runs (
  id uuid primary key default gen_random_uuid(),
  position_id text not null,
  grant_id text not null,
  reason text not null default 'deleverage-guard' check (reason in ('deleverage-guard')),
  triggered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed', 'stopped')),
  health_factor_at_trigger numeric,
  health_factor_target numeric not null,
  tranche_ids_planned jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb
);

create index coordinator_runs_position_idx on public.coordinator_runs (position_id, triggered_at desc);

alter table public.automation_strategies enable row level security;
alter table public.coordinator_delegation_grants enable row level security;
alter table public.coordinator_runs enable row level security;

comment on table public.automation_strategies is 'Durable automation strategy definitions for the rebalance executor. Written/read only via the service role (lib/automation/strategiesStore.ts in the web-app) — no anon/authenticated RLS policies are defined, matching this project''s other server-only tables.';
comment on table public.coordinator_delegation_grants is 'Delegation grants authorizing coordinator deleverage-guard runs per position. Written/read only via the service role (SupabaseCoordinatorLedgerStore in lib/coordinator/ledger.ts) — no anon/authenticated RLS policies are defined, matching this project''s other server-only tables.';
comment on table public.coordinator_runs is 'In-progress and completed coordinator deleverage-guard runs, keyed by position. Written/read only via the service role (SupabaseCoordinatorLedgerStore in lib/coordinator/ledger.ts) — no anon/authenticated RLS policies are defined, matching this project''s other server-only tables.';
