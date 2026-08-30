-- Durable store for the leverage coordinator's delegation grants and runs.
-- See lib/coordinator/ledger (web-app) for the store built on top of these tables.

create table public.coordinator_delegation_grants (
  position_id text primary key,
  id text not null,
  status text not null check (status in ('active', 'revoked')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index coordinator_delegation_grants_id_idx
  on public.coordinator_delegation_grants (id);
create index coordinator_delegation_grants_status_idx
  on public.coordinator_delegation_grants (status);

create table public.coordinator_runs (
  id text primary key,
  position_id text not null,
  status text not null check (status in ('in_progress', 'completed', 'failed', 'stopped')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coordinator_runs_position_id_idx
  on public.coordinator_runs (position_id);
create index coordinator_runs_status_idx
  on public.coordinator_runs (status);

alter table public.coordinator_delegation_grants enable row level security;
alter table public.coordinator_runs enable row level security;

comment on table public.coordinator_delegation_grants is 'Leverage-coordinator DelegationGrant records, one per position. Written/read only via the service role (lib/coordinator/ledger in the web-app) — no anon/authenticated RLS policies are defined, matching this project''s other server-only tables.';
comment on table public.coordinator_runs is 'Leverage-coordinator CoordinatorRun records for crash-resumable unwind jobs. Written/read only via the service role (lib/coordinator/ledger in the web-app) — no anon/authenticated RLS policies are defined, matching this project''s other server-only tables.';
