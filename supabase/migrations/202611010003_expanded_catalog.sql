-- Additive recipe catalog expansion. Existing version-one recipes and validator grants remain valid.
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
    or p_recipe->>'activityId' not in ('rover-ramp', 'projectile', 'pendulum', 'wind-tunnel', 'free-fall', 'bounce')
    or jsonb_typeof(p_recipe->'worldId') is distinct from 'string'
    or p_recipe->>'worldId' not in ('earth', 'moon', 'mars', 'mercury', 'venus', 'titan')
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
    when 'free-fall' then
      return v_params ?& array['heightM', 'massKg', 'dragEnabled']
        and v_params - array['heightM', 'massKg', 'dragEnabled'] = '{}'::jsonb
        and public.planet_lab_number_between(v_params->'heightM', 0.5, 10)
        and public.planet_lab_number_between(v_params->'massKg', 0.1, 20)
        and jsonb_typeof(v_params->'dragEnabled') is not distinct from 'boolean';
    when 'bounce' then
      return v_params ?& array['heightM', 'restitution', 'massKg']
        and v_params - array['heightM', 'restitution', 'massKg'] = '{}'::jsonb
        and public.planet_lab_number_between(v_params->'heightM', 0.5, 5)
        and public.planet_lab_number_between(v_params->'restitution', 0, 0.95)
        and public.planet_lab_number_between(v_params->'massKg', 0.1, 10);
    else
      return false;
  end case;
end;
$$;
