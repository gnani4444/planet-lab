-- Run after all migrations in a disposable test database. Fixtures roll back.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111') on conflict (id) do nothing;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
do $$
declare
  world text;
  recipe jsonb;
begin
  foreach world in array array['earth','moon','mars','mercury','venus','titan'] loop
    recipe := jsonb_build_object('schemaVersion',1,'activityId','free-fall','worldId',world,'seed',42,
      'params',jsonb_build_object('heightM',5,'massKg',1,'dragEnabled',false));
    insert into public.experiments(owner_id,title,schema_version,recipe)
      values ('11111111-1111-4111-8111-111111111111','Free fall catalog',1,recipe);
    recipe := jsonb_set(recipe,'{activityId}','"bounce"');
    recipe := jsonb_set(recipe,'{params}','{"heightM":3,"massKg":1,"restitution":0.7}');
    insert into public.experiments(owner_id,title,schema_version,recipe)
      values ('11111111-1111-4111-8111-111111111111','Bounce catalog',1,recipe);
  end loop;
  if (select count(*) from public.experiments where title in ('Free fall catalog','Bounce catalog')) <> 12 then
    raise exception 'Expanded catalog save count mismatch';
  end if;
  if public.planet_lab_recipe_is_valid(jsonb_set(recipe,'{params,restitution}','1.1'))
    or public.planet_lab_recipe_is_valid(jsonb_set(recipe,'{params,heightM}','0'))
    or public.planet_lab_recipe_is_valid(jsonb_set(recipe,'{params,extra}','true'))
    or public.planet_lab_recipe_is_valid(jsonb_set(recipe,'{worldId}','"jupiter"')) then
    raise exception 'Invalid catalog recipe accepted';
  end if;
end;
$$;
rollback;
