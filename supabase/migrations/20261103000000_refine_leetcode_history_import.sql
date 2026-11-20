create or replace function public.import_leetcode_history(p_problems jsonb)
returns table (
  imported_count integer,
  already_tracked_count integer,
  skipped_count integer,
  failed_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := pg_catalog.clock_timestamp();
  v_problem jsonb;
  v_frontend_id text;
  v_slug text;
  v_status text;
  v_date_text text;
  v_activity_date date;
  v_topics text[];
  v_imported integer := 0;
  v_already integer := 0;
  v_skipped integer := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;
  if p_problems is null or pg_catalog.jsonb_typeof(p_problems) <> 'array'
    or pg_catalog.jsonb_array_length(p_problems) > 4000 then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_problems) item
    where pg_catalog.jsonb_typeof(item) <> 'object'
      or coalesce(item->>'frontend_id', '') !~ '^[0-9]+$'
      or coalesce(item->>'slug', '') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or coalesce(pg_catalog.btrim(item->>'title'), '') = ''
      or coalesce(item->>'difficulty', '') not in ('easy', 'medium', 'hard')
      or coalesce(item->>'leetcode_url', '') <> 'https://leetcode.com/problems/' || (item->>'slug') || '/'
      or coalesce(item->>'external_practice_status', '') not in ('accepted', 'attempted_only')
      or pg_catalog.jsonb_typeof(coalesce(item->'topics', '[]'::jsonb)) <> 'array'
      or (item->>'external_activity_date' is not null
        and item->>'external_activity_date' !~ '^\d{4}-\d{2}-\d{2}$')
      or exists (
        select 1 from pg_catalog.jsonb_array_elements(coalesce(item->'topics', '[]'::jsonb)) topic
        where pg_catalog.jsonb_typeof(topic) <> 'string'
          or pg_catalog.btrim(topic #>> '{}') = ''
      )
  ) then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_problems) item
    group by item->>'frontend_id' having count(*) > 1
  ) or exists (
    select 1 from pg_catalog.jsonb_array_elements(p_problems) item
    group by item->>'slug' having count(*) > 1
  ) then
    raise exception 'invalid_submission' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('leetcode-history-import:' || v_user_id::text, 0)
  );

  for v_problem in select value from pg_catalog.jsonb_array_elements(p_problems) loop
    v_frontend_id := pg_catalog.btrim(v_problem->>'frontend_id');
    v_slug := v_problem->>'slug';
    v_status := v_problem->>'external_practice_status';
    v_date_text := v_problem->>'external_activity_date';
    v_activity_date := case when v_date_text is null then null else v_date_text::date end;
    if v_activity_date > (v_now at time zone 'Pacific/Kiritimati')::date then
      raise exception 'invalid_submission' using errcode = 'P0001';
    end if;
    select coalesce(pg_catalog.array_agg(topic #>> '{}'), '{}'::text[])
      into v_topics
      from pg_catalog.jsonb_array_elements(coalesce(v_problem->'topics', '[]'::jsonb)) topic;

    if exists (
      select 1 from public.user_problems
      where user_id = v_user_id
        and (leetcode_frontend_id = v_frontend_id or leetcode_slug = v_slug)
    ) then
      v_already := v_already + 1;
      continue;
    end if;

    if v_status = 'attempted_only' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      insert into public.user_problems(
        user_id, leetcode_frontend_id, leetcode_slug, leetcode_url, title,
        difficulty, leetcode_topics, notes, lifecycle_state, review_stage,
        last_reviewed_at, next_review_at, mastery_score, total_reviews,
        source, external_practice_status, external_activity_date
      ) values (
        v_user_id, v_frontend_id, v_slug, v_problem->>'leetcode_url',
        v_problem->>'title', v_problem->>'difficulty', v_topics, '', 'active', 0,
        null, v_now, 0, 0,
        'leetcode_import', 'accepted', v_activity_date
      );
      v_imported := v_imported + 1;
    exception when unique_violation then
      v_already := v_already + 1;
    end;
  end loop;

  return query select v_imported, v_already, v_skipped, 0;
exception
  when invalid_datetime_format or datetime_field_overflow or check_violation then
    raise exception 'invalid_submission' using errcode = 'P0001';
end;
$$;

revoke execute on function public.import_leetcode_history(jsonb) from public, anon;
grant execute on function public.import_leetcode_history(jsonb) to authenticated;
