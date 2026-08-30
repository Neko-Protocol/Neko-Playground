-- Durable store for automation rebalance strategies. See lib/automation/strategiesStore
-- (web-app) for the store built on top of this table.

create table public.automation_strategies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  preset text not null,
  rule jsonb not null,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.automation_strategies enable row level security;

comment on table public.automation_strategies is 'Automation rebalance strategy definitions (preset, rule, enabled). Written/read only via the service role (lib/automation/strategiesStore in the web-app) — no anon/authenticated RLS policies are defined, matching this project''s other server-only tables.';
