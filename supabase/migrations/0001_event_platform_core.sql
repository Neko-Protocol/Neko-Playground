-- Event platform: wallet-signature auth (SEP-10-lite challenge/session) and
-- the durable outbox (platform_events) with its hysteresis / suppression /
-- escalation state machine (alert_dedupe_state). See
-- 0003_event_platform_functions.sql's fn_raise_platform_event for the
-- atomic transition logic that gates writes into platform_events.
--
-- These migrations were written and reviewed but not applied to any
-- project during development — the connected Supabase project holds live
-- production data, and creating an isolated dev branch via MCP requires a
-- cost-confirmation step unavailable in that session. Apply them yourself
-- against a dev branch first, in order (0001 -> 0003):
--
--   supabase branches create durable-event-platform
--   supabase db push --db-url <branch-connection-string>
--
-- Required server env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see
-- apps/web-app/.env.example) — never exposed to the client; every table
-- below has RLS enabled with no anon/authenticated policies, so only the
-- service-role key (used server-side by lib/event-platform/supabaseServer.ts)
-- can read/write them.

create table if not exists public.wallet_auth_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  nonce_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wallet_auth_challenges_wallet_idx
  on public.wallet_auth_challenges (wallet_address, expires_at);

alter table public.wallet_auth_challenges enable row level security;

create table if not exists public.wallet_sessions (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists wallet_sessions_wallet_idx
  on public.wallet_sessions (wallet_address);

alter table public.wallet_sessions enable row level security;

create table if not exists public.platform_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  wallet_address text not null,
  dedupe_key text not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  payload jsonb not null default '{}'::jsonb,
  incident_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists platform_events_wallet_idx
  on public.platform_events (wallet_address, created_at desc);

create index if not exists platform_events_source_idx
  on public.platform_events (source, wallet_address, dedupe_key);

create index if not exists platform_events_incident_idx
  on public.platform_events (incident_id);

alter table public.platform_events enable row level security;

create table if not exists public.alert_dedupe_state (
  source text not null,
  wallet_address text not null,
  dedupe_key text not null,
  current_status text not null default 'resolved' check (current_status in ('active', 'resolved')),
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  cycle_count integer not null default 0,
  last_event_id uuid,
  last_transition_at timestamptz,
  suppressed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (source, wallet_address, dedupe_key)
);

alter table public.alert_dedupe_state enable row level security;
