-- Event platform: the atomic RPCs that give the outbox its guarantees.
--
-- fn_raise_platform_event is the single write path into platform_events. It
-- runs as one Postgres transaction: lock the dedupe state row, decide
-- whether this is a genuine transition (first breach, resolution, or a
-- severity escalation while still active) or a no-op (already active at the
-- same/lower severity, or inside the post-resolution suppression window),
-- and if it is a transition, insert the event, run cross-source
-- correlation, and enqueue one event_deliveries row per eligible channel —
-- all before releasing the lock. A concurrent evaluation for the same
-- (source, wallet_address, dedupe_key) blocks on the row lock rather than
-- racing, which is what makes "exactly one delivered event per transition"
-- hold even when the same condition is evaluated from overlapping cron runs.
--
-- The identical decision logic is re-implemented as a pure function in
-- apps/web-app/src/lib/event-platform/dedup.ts (computeTransition) and
-- exhaustively unit tested there, since asserting on plpgsql control flow
-- directly is impractical. This function is a deliberate, short, faithful
-- translation of that logic — see the code comment in dedup.ts before
-- changing either side.

create or replace function public.fn_raise_platform_event(
  p_source text,
  p_wallet_address text,
  p_dedupe_key text,
  p_event_type text,
  p_severity text,
  p_payload jsonb default '{}'::jsonb,
  p_is_resolution boolean default false,
  p_suppression_window_seconds integer default 300,
  p_correlation_window_seconds integer default 300,
  p_escalation_cycle_threshold integer default 3
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_state public.alert_dedupe_state%rowtype;
  v_now timestamptz := now();
  v_should_emit boolean := false;
  v_escalated boolean := false;
  v_effective_severity text := p_severity;
  v_event_id uuid;
  v_incident_id uuid;
  v_correlated_event_id uuid;
  v_correlated_incident_id uuid;
  v_severity_rank_new integer;
  v_severity_rank_old integer;
  v_next_cycle_count integer;
begin
  insert into public.alert_dedupe_state (source, wallet_address, dedupe_key)
  values (p_source, p_wallet_address, p_dedupe_key)
  on conflict (source, wallet_address, dedupe_key) do nothing;

  select * into v_state
  from public.alert_dedupe_state
  where source = p_source and wallet_address = p_wallet_address and dedupe_key = p_dedupe_key
  for update;

  if p_is_resolution then
    if v_state.current_status = 'active' then
      update public.alert_dedupe_state
      set current_status = 'resolved',
          cycle_count = 0,
          last_transition_at = v_now,
          suppressed_until = v_now + make_interval(secs => p_suppression_window_seconds),
          updated_at = v_now
      where source = p_source and wallet_address = p_wallet_address and dedupe_key = p_dedupe_key;
      return jsonb_build_object('created', false, 'reason', 'resolution-recorded');
    end if;
    return jsonb_build_object('created', false, 'reason', 'already-resolved');
  end if;

  v_severity_rank_new := case p_severity when 'critical' then 3 when 'warning' then 2 else 1 end;
  v_severity_rank_old := case v_state.severity when 'critical' then 3 when 'warning' then 2 else 1 end;

  if v_state.current_status = 'resolved' then
    if v_state.suppressed_until is not null and v_now < v_state.suppressed_until then
      return jsonb_build_object('created', false, 'reason', 'suppressed');
    end if;
    v_should_emit := true;
    v_effective_severity := p_severity;
  else
    if v_severity_rank_new > v_severity_rank_old then
      v_should_emit := true;
      v_escalated := true;
      v_effective_severity := p_severity;
    else
      -- Still active at the same/lower severity as last time: this is a
      -- repeat evaluation of an ongoing condition, not a new transition, so
      -- no event is emitted for it on its own. But if it has now persisted
      -- for p_escalation_cycle_threshold cycles and isn't already at the
      -- top severity, auto-escalate one level (info->warning->critical) —
      -- this is what "a condition that persists across evaluation cycles
      -- escalates severity" means when the caller keeps reporting the same
      -- severity rather than a worsening one itself.
      v_next_cycle_count := v_state.cycle_count + 1;
      if v_next_cycle_count >= p_escalation_cycle_threshold and v_severity_rank_old < 3 then
        v_should_emit := true;
        v_escalated := true;
        v_effective_severity := case v_state.severity when 'info' then 'warning' else 'critical' end;
      else
        update public.alert_dedupe_state
        set cycle_count = v_next_cycle_count, updated_at = v_now
        where source = p_source and wallet_address = p_wallet_address and dedupe_key = p_dedupe_key;
        return jsonb_build_object('created', false, 'reason', 'already-active');
      end if;
    end if;
  end if;

  insert into public.platform_events (source, wallet_address, dedupe_key, event_type, severity, payload)
  values (p_source, p_wallet_address, p_dedupe_key, p_event_type, v_effective_severity, coalesce(p_payload, '{}'::jsonb))
  returning id into v_event_id;

  update public.alert_dedupe_state
  set current_status = 'active',
      severity = v_effective_severity,
      cycle_count = case when v_escalated then coalesce(v_next_cycle_count, cycle_count + 1) else 1 end,
      last_event_id = v_event_id,
      last_transition_at = v_now,
      suppressed_until = null,
      updated_at = v_now
  where source = p_source and wallet_address = p_wallet_address and dedupe_key = p_dedupe_key;

  v_severity_rank_new := case v_effective_severity when 'critical' then 3 when 'warning' then 2 else 1 end;

  select pe.id, pe.incident_id
  into v_correlated_event_id, v_correlated_incident_id
  from public.platform_events pe
  where pe.wallet_address = p_wallet_address
    and pe.source <> p_source
    and pe.id <> v_event_id
    and pe.created_at >= v_now - make_interval(secs => p_correlation_window_seconds)
  order by pe.created_at desc
  limit 1;

  if v_correlated_event_id is not null then
    if v_correlated_incident_id is not null then
      v_incident_id := v_correlated_incident_id;
    else
      insert into public.incidents (wallet_address, title, severity, status)
      values (p_wallet_address, format('Correlated %s + %s activity', p_source, p_event_type), v_effective_severity, 'open')
      returning id into v_incident_id;

      insert into public.incident_events (incident_id, event_id)
      values (v_incident_id, v_correlated_event_id)
      on conflict do nothing;

      update public.platform_events set incident_id = v_incident_id where id = v_correlated_event_id;
    end if;

    insert into public.incident_events (incident_id, event_id)
    values (v_incident_id, v_event_id)
    on conflict do nothing;

    update public.platform_events set incident_id = v_incident_id where id = v_event_id;
  end if;

  -- in_app is always enqueued (it is the Alerts view's own source of truth);
  -- webhook/email are gated by verification + preferences, defaulting to
  -- "allowed" when the wallet has not configured preferences yet.
  insert into public.event_deliveries (event_id, channel)
  select v_event_id, chan.channel_type
  from (
    select 'in_app'::text as channel_type
    union all
    select nc.channel_type
    from public.notification_channels nc
    where nc.wallet_address = p_wallet_address
      and nc.verified_at is not null
  ) chan
  left join public.notification_preferences np on np.wallet_address = p_wallet_address
  where
    chan.channel_type = 'in_app'
    or np.wallet_address is null
    or (
      np.sources @> to_jsonb(p_source)
      and v_severity_rank_new >= (case np.min_severity when 'critical' then 3 when 'warning' then 2 else 1 end)
      and np.channels @> to_jsonb(chan.channel_type)
    )
  on conflict (event_id, channel) do nothing;

  insert into public.delivery_audit_log (delivery_id, stage)
  select ed.id, 'created' from public.event_deliveries ed where ed.event_id = v_event_id;

  insert into public.delivery_audit_log (delivery_id, stage)
  select ed.id, 'queued' from public.event_deliveries ed where ed.event_id = v_event_id;

  return jsonb_build_object(
    'created', true,
    'event_id', v_event_id,
    'incident_id', v_incident_id,
    'escalated', v_escalated
  );
end;
$$;

-- Atomically claims up to p_limit due deliveries for one channel, marking
-- them 'processing' so an overlapping worker invocation cannot claim the
-- same row (FOR UPDATE SKIP LOCKED). This is what makes the drain worker an
-- idempotent consumer under redelivery/overlap.
create or replace function public.fn_claim_deliveries(
  p_channel text,
  p_limit integer default 25
) returns setof public.event_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.event_deliveries ed
  set status = 'processing', updated_at = now()
  where ed.id in (
    select id from public.event_deliveries
    where channel = p_channel
      and status in ('pending', 'failed')
      and next_attempt_at <= now()
    order by next_attempt_at asc
    for update skip locked
    limit p_limit
  )
  returning ed.*;
end;
$$;

-- Records the outcome of one delivery attempt: on success, marks delivered;
-- on failure, either schedules an exponential-backoff retry or, once
-- p_max_attempts is exhausted, transitions to dead_letter. Always appends an
-- 'attempted' audit row first, so partial failures are still inspectable.
create or replace function public.fn_record_delivery_outcome(
  p_delivery_id uuid,
  p_success boolean,
  p_error text default null,
  p_max_attempts integer default 5,
  p_base_backoff_seconds integer default 30
) returns public.event_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.event_deliveries%rowtype;
  v_attempts integer;
  v_backoff integer;
begin
  select * into v_row from public.event_deliveries where id = p_delivery_id for update;
  v_attempts := v_row.attempts + 1;

  insert into public.delivery_audit_log (delivery_id, stage, outcome, detail)
  values (
    p_delivery_id,
    'attempted',
    case when p_success then 'success' else 'failure' end,
    case when p_error is not null then jsonb_build_object('error', p_error) else null end
  );

  if p_success then
    update public.event_deliveries
    set status = 'delivered', attempts = v_attempts, delivered_at = now(), last_error = null, updated_at = now()
    where id = p_delivery_id
    returning * into v_row;

    insert into public.delivery_audit_log (delivery_id, stage, outcome)
    values (p_delivery_id, 'delivered', 'success');
  elsif v_attempts >= p_max_attempts then
    update public.event_deliveries
    set status = 'dead_letter', attempts = v_attempts, last_error = p_error, updated_at = now()
    where id = p_delivery_id
    returning * into v_row;

    insert into public.delivery_audit_log (delivery_id, stage, outcome, detail)
    values (p_delivery_id, 'dead_letter', 'exhausted', jsonb_build_object('error', p_error));
  else
    v_backoff := p_base_backoff_seconds * power(2, v_attempts - 1);
    update public.event_deliveries
    set status = 'failed',
        attempts = v_attempts,
        last_error = p_error,
        next_attempt_at = now() + make_interval(secs => v_backoff),
        updated_at = now()
    where id = p_delivery_id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- Fixed-window rate limiter: returns true if the wallet/channel is still
-- under p_max_per_window for the current window, incrementing atomically
-- either way so the check-and-increment is race-free under concurrent sends.
create or replace function public.fn_check_and_increment_rate_limit(
  p_wallet_address text,
  p_channel_type text,
  p_window_seconds integer default 60,
  p_max_per_window integer default 5
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.channel_rate_limit_windows (wallet_address, channel_type, window_start, count)
  values (p_wallet_address, p_channel_type, v_window_start, 1)
  on conflict (wallet_address, channel_type, window_start)
  do update set count = channel_rate_limit_windows.count + 1
  returning count into v_count;

  return v_count <= p_max_per_window;
end;
$$;
