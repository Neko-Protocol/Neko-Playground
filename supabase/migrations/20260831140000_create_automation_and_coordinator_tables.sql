-- Durable persistence for automation strategies and the leverage coordinator ledger (#317).

create table public.automation_strategies (
  id text primary key,
  name text not null,
  preset text not null,
  rule jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_strategies_enabled_idx on public.automation_strategies (enabled);

create table public.coordinator_grants (
  id text primary key,
  position_id text not null unique,
  wallet_address text not null,
  asset_code text not null,
  borrow_asset_code text not null,
  status text not null check (status in ('active', 'revoked')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  tranches jsonb not null default '[]'::jsonb,
  consumed_tranche_ids text[] not null default '{}',
  guard_config jsonb not null default '{}'::jsonb,
  breached boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coordinator_grants_status_expires_idx on public.coordinator_grants (status, expires_at);
create index coordinator_grants_wallet_idx on public.coordinator_grants (wallet_address);

create table public.coordinator_runs (
  id text primary key,
  position_id text not null references public.coordinator_grants (position_id) on delete cascade,
  grant_id text not null references public.coordinator_grants (id) on delete cascade,
  reason text not null,
  status text not null check (status in ('in_progress', 'completed', 'failed', 'stopped')),
  health_factor_at_trigger double precision,
  health_factor_target double precision not null,
  tranche_ids_planned text[] not null default '{}',
  steps jsonb not null default '[]'::jsonb,
  triggered_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coordinator_runs_position_status_idx on public.coordinator_runs (position_id, status);
create index coordinator_runs_position_triggered_idx on public.coordinator_runs (position_id, triggered_at desc);

alter table public.automation_strategies enable row level security;
alter table public.coordinator_grants enable row level security;
alter table public.coordinator_runs enable row level security;

comment on table public.automation_strategies is 'Durable persistence for user-configured automation strategies, replacing in-memory Map store.';
comment on table public.coordinator_grants is 'Durable delegation grants for the leverage coordinator, replacing file-based ledger.';
comment on table public.coordinator_runs is 'Durable execution runs and crash-resumption ledger for the leverage coordinator.';
