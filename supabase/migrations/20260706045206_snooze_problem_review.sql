create or replace function public.snooze_problem_review(
  p_user_problem_id uuid,
  p_expected_schedule_version bigint,
  p_time_zone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_problem public.user_problems%rowtype;
  v_updated_count integer;
  v_time_zone text := pg_catalog.btrim(p_time_zone);
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  if p_user_problem_id is null
    or p_expected_schedule_version is null
    or p_time_zone is null
  then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  if v_time_zone = ''
    or not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_time_zone
  ) then
    raise exception 'invalid_time_zone' using errcode = 'P0001';
  end if;

  select *
  into v_problem
  from public.user_problems
  where id = p_user_problem_id
    and user_id = v_user_id;

  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if v_problem.lifecycle_state <> 'active' then
    raise exception 'problem_not_active' using errcode = 'P0001';
  end if;

  if v_problem.schedule_version <> p_expected_schedule_version then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;

  if v_problem.next_review_at > pg_catalog.now() then
    raise exception 'problem_not_due' using errcode = 'P0001';
  end if;

  update public.user_problems
  set
    next_review_at = (
      ((pg_catalog.now() at time zone v_time_zone)::date + 1)::timestamp
      at time zone v_time_zone
    ),
    schedule_version = schedule_version + 1,
    updated_at = pg_catalog.now()
  where id = p_user_problem_id
    and user_id = v_user_id
    and lifecycle_state = 'active'
    and next_review_at <= pg_catalog.now()
    and schedule_version = p_expected_schedule_version;

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> 1 then
    raise exception 'stale_review' using errcode = 'P0001';
  end if;
end;
$$;

revoke execute on function public.snooze_problem_review(uuid, bigint, text) from public;
revoke execute on function public.snooze_problem_review(uuid, bigint, text) from anon;
grant execute on function public.snooze_problem_review(uuid, bigint, text) to authenticated;
