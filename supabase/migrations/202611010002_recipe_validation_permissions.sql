-- CHECK constraints invoke these pure validators with the writing role's privileges.
-- Grant only validation access; ownership policies and privileged quota RPCs stay unchanged.
grant execute on function public.planet_lab_number_between(jsonb, numeric, numeric, boolean)
  to authenticated, service_role;
grant execute on function public.planet_lab_recipe_is_valid(jsonb)
  to authenticated, service_role;
