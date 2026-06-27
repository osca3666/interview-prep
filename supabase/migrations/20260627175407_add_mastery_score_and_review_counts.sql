alter table public.user_problems
  add column mastery_score integer not null default 0,
  add column total_reviews integer not null default 0;

update public.user_problems as user_problem
set
  total_reviews = (
    select count(*)::integer
    from public.review_events as review_event
    where review_event.user_problem_id = user_problem.id
      and review_event.user_id = user_problem.user_id
  ),
  mastery_score = least(10, user_problem.review_stage * 2);

alter table public.user_problems
  add constraint user_problems_mastery_score_check
  check (mastery_score between 0 and 10),
  add constraint user_problems_total_reviews_check
  check (total_reviews >= 0);

create or replace function public.submit_problem_review(
  p_user_problem_id uuid,
  p_rating text,
  p_expected_schedule_version bigint
)
returns table (
  new_review_stage integer,
  new_next_review_at timestamptz,
  new_schedule_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_problem public.user_problems%rowtype;
  v_reviewed_at timestamptz := pg_catalog.now();
  v_new_review_stage integer;
  v_new_next_review_at timestamptz;
  v_new_schedule_version bigint;
  v_new_mastery_score integer;
  v_new_total_reviews integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated'
      using errcode = 'P0001';
  end if;

  if p_user_problem_id is null then
    raise exception 'problem_not_due'
      using errcode = 'P0001';
  end if;

  if p_rating is null
     or p_rating not in ('again', 'hard', 'good', 'easy') then
    raise exception 'invalid_rating'
      using errcode = 'P0001';
  end if;

  if p_expected_schedule_version is null
     or p_expected_schedule_version < 0 then
    raise exception 'stale_review'
      using errcode = 'P0001';
  end if;

  select *
    into v_problem
  from public.user_problems
  where id = p_user_problem_id
    and user_id = v_user_id
    and lifecycle_state = 'active'
  for update;

  if not found then
    raise exception 'problem_not_due'
      using errcode = 'P0001';
  end if;

  if v_problem.schedule_version <> p_expected_schedule_version then
    raise exception 'stale_review'
      using errcode = 'P0001';
  end if;

  if v_problem.next_review_at > v_reviewed_at then
    raise exception 'problem_not_due'
      using errcode = 'P0001';
  end if;

  v_new_review_stage := case p_rating
    when 'again' then 0
    when 'hard' then v_problem.review_stage
    when 'good' then v_problem.review_stage + 1
    when 'easy' then v_problem.review_stage + 2
  end;

  v_new_next_review_at := v_reviewed_at + case
    when p_rating = 'again' then interval '1 day'
    when v_new_review_stage = 0 then interval '2 days'
    when v_new_review_stage = 1 then interval '3 days'
    when v_new_review_stage = 2 then interval '7 days'
    when v_new_review_stage = 3 then interval '14 days'
    when v_new_review_stage = 4 then interval '30 days'
    else interval '60 days'
  end;

  v_new_schedule_version := v_problem.schedule_version + 1;

  v_new_mastery_score := case p_rating
    when 'again' then greatest(0, v_problem.mastery_score - 2)
    when 'hard' then least(10, v_problem.mastery_score + 1)
    when 'good' then least(10, v_problem.mastery_score + 2)
    when 'easy' then least(10, v_problem.mastery_score + 3)
  end;

  v_new_total_reviews := v_problem.total_reviews + 1;

  insert into public.review_events (
    user_id,
    user_problem_id,
    rating,
    previous_review_stage,
    new_review_stage,
    previous_next_review_at,
    next_review_at,
    reviewed_at
  )
  values (
    v_user_id,
    v_problem.id,
    p_rating,
    v_problem.review_stage,
    v_new_review_stage,
    v_problem.next_review_at,
    v_new_next_review_at,
    v_reviewed_at
  );

  update public.user_problems
  set
    review_stage = v_new_review_stage,
    last_reviewed_at = v_reviewed_at,
    next_review_at = v_new_next_review_at,
    updated_at = v_reviewed_at,
    schedule_version = v_new_schedule_version,
    mastery_score = v_new_mastery_score,
    total_reviews = v_new_total_reviews
  where id = v_problem.id
    and user_id = v_user_id;

  return query select
    v_new_review_stage,
    v_new_next_review_at,
    v_new_schedule_version;
end;
$$;

revoke execute on function public.submit_problem_review(uuid, text, bigint) from public;
revoke execute on function public.submit_problem_review(uuid, text, bigint) from anon;
grant execute on function public.submit_problem_review(uuid, text, bigint) to authenticated;
