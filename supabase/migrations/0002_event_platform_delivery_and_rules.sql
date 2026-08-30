-- Event platform: the delivery queue and its audit trail, per-wallet
-- channel/preference/rate-limit configuration, the durable
-- borrowing-threshold registry, the declarative rule engine's rule storage,
-- and cross-module correlation (incidents).
--
-- Note: this PR's application code only uses platform_events,
-- alert_dedupe_state, and incidents/incident_events (via
-- fn_raise_platform_event's built-in correlation) — event_deliveries,
-- notification_channels/preferences, borrowing_thresholds, and
-- rule_definitions are schema for the queue-draining, multi-channel
-- delivery, and borrowing-monitor work landing in a follow-up PR. Shipping
-- the full schema now avoids a second migration pass touching the same
-- tables later.

create table if not exists public.event_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.platform_events (id) on delete cascade,
  channel text not null check (channel in ('in_app', 'webhook', 'email')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'delivered', 'failed', 'dead_letter')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, channel)
);

create index if not exists event_deliveries_claim_idx
  on public.event_deliveries (channel, status, next_attempt_at);

alter table public.event_deliveries enable row level security;

create table if not exists public.delivery_audit_log (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.event_deliveries (id) on delete cascade,
  stage text not null check (stage in ('created', 'queued', 'attempted', 'delivered', 'dead_letter')),
  outcome text,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index if not exists delivery_audit_log_delivery_idx
  on public.delivery_audit_log (delivery_id);

alter table public.delivery_audit_log enable row level security;

create table if not exists public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  channel_type text not null check (channel_type in ('webhook', 'email')),
  destination text not null,
  verified_at timestamptz,
  verification_token_hash text,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wallet_address, channel_type, destination)
);

create index if not exists notification_channels_wallet_idx
  on public.notification_channels (wallet_address);

alter table public.notification_channels enable row level security;

create table if not exists public.notification_preferences (
  wallet_address text primary key,
  sources jsonb not null default '["swap", "automation", "vault", "borrowing"]'::jsonb,
  min_severity text not null default 'warning' check (min_severity in ('info', 'warning', 'critical')),
  channels jsonb not null default '["in_app"]'::jsonb,
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint check (quiet_hours_end between 0 and 23),
  digest_mode text not null default 'immediate' check (digest_mode in ('immediate', 'digest')),
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create table if not exists public.channel_rate_limit_windows (
  wallet_address text not null,
  channel_type text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (wallet_address, channel_type, window_start)
);

alter table public.channel_rate_limit_windows enable row level security;

create table if not exists public.borrowing_thresholds (
  wallet_address text not null,
  contract_id text not null,
  kind text not null default 'threshold' check (kind in ('threshold', 'danger-zone')),
  threshold_hf numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (wallet_address, contract_id, kind)
);

alter table public.borrowing_thresholds enable row level security;

create table if not exists public.rule_definitions (
  id uuid primary key default gen_random_uuid(),
  -- null wallet_address = a global/default rule applied to every wallet
  wallet_address text,
  source text not null,
  name text not null,
  condition jsonb not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rule_definitions_source_idx
  on public.rule_definitions (source, enabled);

alter table public.rule_definitions enable row level security;

create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null,
  title text not null,
  severity text not null default 'warning' check (severity in ('info', 'warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists incidents_wallet_idx
  on public.incidents (wallet_address, status);

alter table public.incidents enable row level security;

create table if not exists public.incident_events (
  incident_id uuid not null references public.incidents (id) on delete cascade,
  event_id uuid not null references public.platform_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (incident_id, event_id)
);

alter table public.incident_events enable row level security;

alter table public.platform_events
  add constraint platform_events_incident_fk
  foreign key (incident_id) references public.incidents (id) on delete set null;
