create or replace function public.create_user_problem(
  p_leetcode_slug text,
  p_leetcode_url text,
  p_title text,
  p_difficulty text,
  p_pattern text,
  p_notes text,
  p_start_mode text,
  p_rating text,
  p_start_date date
)
returns table (
  user_problem_id uuid,
  review_stage integer,
  next_review_at timestamptz,
  mastery_score integer,
  total_reviews integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_user_problem_id uuid;
  v_review_stage integer;
  v_next_review_at timestamptz;
  v_mastery_score integer;
  v_total_reviews integer;
  v_reviewed_at timestamptz;
  v_constraint_name text;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'not_authenticated'
      using errcode = 'P0001';
  end if;

  if p_start_mode is null
     or p_start_mode not in ('practiced', 'scheduled') then
    raise exception 'invalid_start_mode'
      using errcode = 'P0001';
  end if;

  if p_start_date is null then
    raise exception 'invalid_date'
      using errcode = 'P0001';
  end if;

  if p_start_mode = 'practiced'
     and p_start_date > current_date then
    raise exception 'invalid_date'
      using errcode = 'P0001';
  end if;

  if p_start_mode = 'practiced'
     and (p_rating is null
          or p_rating not in ('again', 'hard', 'good', 'easy')) then
    raise exception 'invalid_rating'
      using errcode = 'P0001';
  end if;

  if p_start_mode = 'practiced' then
    v_reviewed_at := p_start_date::timestamptz;

    v_review_stage := case p_rating
      when 'again' then 0
      when 'hard' then 0
      when 'good' then 1
      when 'easy' then 2
    end;

    v_next_review_at := v_reviewed_at + case p_rating
      when 'again' then interval '1 day'
      when 'hard' then interval '2 days'
      when 'good' then interval '3 days'
      when 'easy' then interval '7 days'
    end;

    v_mastery_score := case p_rating
      when 'again' then 0
      when 'hard' then 1
      when 'good' then 2
      when 'easy' then 3
    end;

    v_total_reviews := 1;
  else
    v_review_stage := 0;
    v_next_review_at := p_start_date::timestamptz;
    v_mastery_score := 0;
    v_total_reviews := 0;
  end if;

  begin
    insert into public.user_problems (
      user_id,
      leetcode_slug,
      leetcode_url,
      title,
      difficulty,
      pattern,
      notes,
      review_stage,
      last_reviewed_at,
      next_review_at,
      mastery_score,
      total_reviews
    )
    values (
      v_user_id,
      p_leetcode_slug,
      p_leetcode_url,
      p_title,
      p_difficulty,
      p_pattern,
      p_notes,
      v_review_stage,
      v_reviewed_at,
      v_next_review_at,
      v_mastery_score,
      v_total_reviews
    )
    returning id into v_user_problem_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint_name = constraint_name;

      if v_constraint_name = 'user_problems_user_id_leetcode_slug_key' then
        raise exception 'duplicate_problem'
          using errcode = 'P0001';
      end if;

      raise;
  end;

  if p_start_mode = 'practiced' then
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
      v_user_problem_id,
      p_rating,
      0,
      v_review_stage,
      null,
      v_next_review_at,
      v_reviewed_at
    );
  end if;

  return query select
    v_user_problem_id,
    v_review_stage,
    v_next_review_at,
    v_mastery_score,
    v_total_reviews;
end;
$$;

revoke execute on function public.create_user_problem(text, text, text, text, text, text, text, text, date) from public;
revoke execute on function public.create_user_problem(text, text, text, text, text, text, text, text, date) from anon;
grant execute on function public.create_user_problem(text, text, text, text, text, text, text, text, date) to authenticated;
