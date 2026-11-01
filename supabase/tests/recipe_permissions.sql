-- Run only against a disposable Supabase/test database after both migrations.
-- All fixture data and session changes are rolled back.
begin;
insert into auth.users(id) values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
insert into public.experiments(id, owner_id, title, schema_version, recipe) values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  'Recipe permission regression', 1,
  '{"schemaVersion":1,"activityId":"rover-ramp","worldId":"mars","seed":42,"params":{"launchSpeedMps":8,"launchAngleDeg":25}}'
);

do $$
begin
  if (select count(*) from public.experiments where id = '33333333-3333-4333-8333-333333333333') <> 1 then
    raise exception 'Owner could not read saved recipe';
  end if;
  begin
    update public.experiments
    set recipe = jsonb_set(recipe, '{params,launchSpeedMps}', '0')
    where id = '33333333-3333-4333-8333-333333333333';
    raise exception 'Invalid recipe was accepted';
  exception when check_violation then null;
  end;
  begin
    perform public.reserve_ai_usage(
      '11111111-1111-4111-8111-111111111111',
      '44444444-4444-4444-8444-444444444444', 'command', 8000, 800
    );
    raise exception 'Authenticated user could reserve privileged quota';
  exception when insufficient_privilege then null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
do $$
declare
  affected integer;
begin
  if exists(select 1 from public.experiments where id = '33333333-3333-4333-8333-333333333333') then
    raise exception 'Another owner could read the recipe';
  end if;
  update public.experiments set title = 'Wrong owner'
    where id = '33333333-3333-4333-8333-333333333333';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another owner could update the recipe'; end if;
  delete from public.experiments where id = '33333333-3333-4333-8333-333333333333';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Another owner could delete the recipe'; end if;
end;
$$;
rollback;
