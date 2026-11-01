-- Core cloud persistence and durable AI quotas for Planet Lab.
create extension if not exists pgcrypto;

create or replace function public.planet_lab_number_between(p_value jsonb, p_min numeric, p_max numeric, p_integer boolean default false)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_number numeric;
begin
  if jsonb_typeof(p_value) is distinct from 'number' then return false; end if;
  v_number := (p_value #>> '{}')::numeric;
  return v_number between p_min and p_max and (not p_integer or v_number = trunc(v_number));
end;
$$;

create or replace function public.planet_lab_recipe_is_valid(p_recipe jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_params jsonb;
begin
  if jsonb_typeof(p_recipe) is distinct from 'object'
    or octet_length(p_recipe::text) > 32768
    or not (p_recipe ?& array['schemaVersion', 'activityId', 'worldId', 'seed', 'params'])
    or p_recipe - array['schemaVersion', 'activityId', 'worldId', 'seed', 'params'] <> '{}'::jsonb
    or jsonb_typeof(p_recipe->'schemaVersion') is distinct from 'number'
    or p_recipe->>'schemaVersion' <> '1'
    or jsonb_typeof(p_recipe->'activityId') is distinct from 'string'
    or p_recipe->>'activityId' not in ('rover-ramp', 'projectile', 'pendulum', 'wind-tunnel')
    or jsonb_typeof(p_recipe->'worldId') is distinct from 'string'
    or p_recipe->>'worldId' not in ('earth', 'moon', 'mars')
    or not public.planet_lab_number_between(p_recipe->'seed', 0, 4294967295, true)
    or jsonb_typeof(p_recipe->'params') is distinct from 'object' then
    return false;
  end if;

  v_params := p_recipe->'params';
  case p_recipe->>'activityId'
    when 'rover-ramp' then
      return v_params ?& array['launchSpeedMps', 'launchAngleDeg']
        and v_params - array['launchSpeedMps', 'launchAngleDeg'] = '{}'::jsonb
        and public.planet_lab_number_between(v_params->'launchSpeedMps', 1, 20)
        and public.planet_lab_number_between(v_params->'launchAngleDeg', 5, 45);
    when 'projectile' then
      return v_params ?& array['objectId', 'massKg', 'speedMps', 'angleDeg', 'releaseHeightM', 'dragEnabled']
        and v_params - array['objectId', 'massKg', 'speedMps', 'angleDeg', 'releaseHeightM', 'dragEnabled'] = '{}'::jsonb
        and jsonb_typeof(v_params->'objectId') is not distinct from 'string'
        and v_params->>'objectId' in ('sphere', 'brick')
        and public.planet_lab_number_between(v_params->'massKg', 0.1, 20)
        and public.planet_lab_number_between(v_params->'speedMps', 0, 30)
        and public.planet_lab_number_between(v_params->'angleDeg', 0, 80)
        and public.planet_lab_number_between(v_params->'releaseHeightM', 0.5, 10)
        and jsonb_typeof(v_params->'dragEnabled') is not distinct from 'boolean';
    when 'pendulum' then
      return v_params ?& array['lengthM', 'bobMassKg', 'initialAngleDeg']
        and v_params - array['lengthM', 'bobMassKg', 'initialAngleDeg'] = '{}'::jsonb
        and public.planet_lab_number_between(v_params->'lengthM', 0.5, 3)
        and public.planet_lab_number_between(v_params->'bobMassKg', 0.1, 10)
        and public.planet_lab_number_between(v_params->'initialAngleDeg', 5, 30);
    when 'wind-tunnel' then
      return v_params ?& array['objectId', 'windSpeedMps', 'areaM2']
        and v_params - array['objectId', 'windSpeedMps', 'areaM2'] = '{}'::jsonb
        and jsonb_typeof(v_params->'objectId') is not distinct from 'string'
        and v_params->>'objectId' in ('sphere', 'plate')
        and public.planet_lab_number_between(v_params->'windSpeedMps', 0, 30)
        and public.planet_lab_number_between(v_params->'areaM2', 0.01, 1);
    else
      return false;
  end case;
end;
$$;

revoke all on function public.planet_lab_number_between(jsonb, numeric, numeric, boolean) from public, anon, authenticated;
revoke all on function public.planet_lab_recipe_is_valid(jsonb) from public, anon, authenticated;

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  schema_version integer not null check (schema_version = 1),
  recipe jsonb not null check (public.planet_lab_recipe_is_valid(recipe)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists experiments_owner_updated_idx
  on public.experiments(owner_id, updated_at desc);

create or replace function public.set_experiments_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists experiments_set_updated_at on public.experiments;
create trigger experiments_set_updated_at
before update on public.experiments
for each row execute function public.set_experiments_updated_at();

revoke all on function public.set_experiments_updated_at() from public, anon, authenticated;

alter table public.experiments enable row level security;
revoke all on public.experiments from anon, authenticated;
grant select, insert, update, delete on public.experiments to authenticated;

drop policy if exists experiments_owner_select on public.experiments;
create policy experiments_owner_select on public.experiments
for select to authenticated using (owner_id = (select auth.uid()));

drop policy if exists experiments_owner_insert on public.experiments;
create policy experiments_owner_insert on public.experiments
for insert to authenticated with check (owner_id = (select auth.uid()));

drop policy if exists experiments_owner_update on public.experiments;
create policy experiments_owner_update on public.experiments
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists experiments_owner_delete on public.experiments;
create policy experiments_owner_delete on public.experiments
for delete to authenticated using (owner_id = (select auth.uid()));

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  operation text not null check (operation in ('command', 'explain')),
  status text not null check (status in ('pending', 'completed', 'failed', 'rejected')),
  reserved_input_tokens integer not null check (reserved_input_tokens between 1 and 8000),
  reserved_output_tokens integer not null check (reserved_output_tokens between 1 and 800),
  actual_input_tokens integer check (actual_input_tokens between 0 and 8000),
  actual_output_tokens integer check (actual_output_tokens between 0 and 800),
  estimated_usd numeric(12, 6),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (estimated_usd is null or estimated_usd >= 0),
  unique (owner_id, request_id)
);

create index if not exists ai_usage_owner_created_idx on public.ai_usage(owner_id, created_at desc);
create index if not exists ai_usage_created_idx on public.ai_usage(created_at desc);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;
revoke all on public.ai_usage from public;

create or replace function public.reserve_ai_usage(
  p_owner_id uuid,
  p_request_id uuid,
  p_operation text,
  p_reserved_input_tokens integer,
  p_reserved_output_tokens integer
)
returns table(status text, reservation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_id uuid;
  v_reservation_id uuid;
  v_utc_day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
begin
  if p_operation not in ('command', 'explain')
    or p_reserved_input_tokens <> 8000
    or p_reserved_output_tokens <> 800 then
    raise exception 'invalid quota reservation';
  end if;

  -- A single transaction lock makes owner/hour and project/day checks atomic.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('planet-lab-ai-quota-v1', 0));

  select usage.id into v_existing_id
  from public.ai_usage as usage
  where usage.owner_id = p_owner_id and usage.request_id = p_request_id;
  if found then
    return query select 'duplicate'::text, v_existing_id;
    return;
  end if;

  if (select count(*) from public.ai_usage as usage
      where usage.owner_id = p_owner_id and usage.created_at >= now() - interval '1 hour') >= 30
    or (select count(*) from public.ai_usage as usage
        where usage.created_at >= v_utc_day_start) >= 2000 then
    return query select 'quota_exceeded'::text, null::uuid;
    return;
  end if;

  insert into public.ai_usage(owner_id, request_id, operation, status, reserved_input_tokens, reserved_output_tokens)
  values (p_owner_id, p_request_id, p_operation, 'pending', p_reserved_input_tokens, p_reserved_output_tokens)
  returning id into v_reservation_id;
  return query select 'reserved'::text, v_reservation_id;
end;
$$;

create or replace function public.finalize_ai_usage(
  p_owner_id uuid,
  p_request_id uuid,
  p_status text,
  p_actual_input_tokens integer,
  p_actual_output_tokens integer,
  p_estimated_usd numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'failed', 'rejected') then
    raise exception 'invalid usage status';
  end if;

  update public.ai_usage
  set status = p_status,
      actual_input_tokens = p_actual_input_tokens,
      actual_output_tokens = p_actual_output_tokens,
      estimated_usd = p_estimated_usd,
      completed_at = now()
  where owner_id = p_owner_id and request_id = p_request_id and status = 'pending';

  if not found then raise exception 'usage reservation not found or already finalized'; end if;
  return true;
end;
$$;

revoke all on function public.reserve_ai_usage(uuid, uuid, text, integer, integer) from public, anon, authenticated;
revoke all on function public.finalize_ai_usage(uuid, uuid, text, integer, integer, numeric) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, uuid, text, integer, integer) to service_role;
grant execute on function public.finalize_ai_usage(uuid, uuid, text, integer, integer, numeric) to service_role;
