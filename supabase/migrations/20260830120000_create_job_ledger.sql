-- Shared, durable execution-ledger primitive backing both the automation
-- rebalance executor and the vault auto-invest cron. See lib/jobs (web-app)
-- for the store/runner built on top of these tables.

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('automation-rebalance', 'vault-invest')),
  external_ref text not null,
  wallet_address text,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  payload jsonb not null default '{}'::jsonb,
  lease_owner text,
  lease_expires_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index job_runs_type_ref_idx on public.job_runs (job_type, external_ref);
create index job_runs_wallet_idx on public.job_runs (wallet_address);

create table public.job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_runs (id) on delete cascade,
  step_index integer not null,
  kind text not null,
  input jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, step_index)
);

create table public.action_log_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.job_runs (id) on delete set null,
  job_type text not null,
  wallet_address text,
  level text not null default 'info' check (level in ('info', 'warn', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index action_log_entries_job_type_idx on public.action_log_entries (job_type, occurred_at desc);
create index action_log_entries_job_id_idx on public.action_log_entries (job_id);

alter table public.job_runs enable row level security;
alter table public.job_steps enable row level security;
alter table public.action_log_entries enable row level security;

comment on table public.job_runs is 'Durable execution-ledger runs shared by automation rebalance plans and the vault auto-invest cron. Written/read only via the service role (lib/jobs in the web-app) — no anon/authenticated RLS policies are defined, matching this project''s other server-only tables.';
comment on table public.job_steps is 'Ordered, idempotent steps of a job_runs row. (job_id, step_index) is the idempotency key referenced in the execution-ledger design.';
comment on table public.action_log_entries is 'Append-only observability feed for job_runs, queryable by job_type; automation entries are additionally scoped by wallet_address.';
