create table public.user_marbles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  review_event_id uuid not null references public.review_events(id) on delete cascade,
  slot_index integer not null check (slot_index >= 0),
  x_position numeric(5,2) not null check (x_position between 0 and 100),
  y_position numeric(5,2) not null check (y_position between 0 and 100),
  rotation_degrees numeric(5,2) not null,
  size_variant integer not null check (size_variant between 0 and 2),
  color_variant integer not null check (color_variant between 0 and 5),
  appearance_seed integer not null,
  dropped_at timestamptz not null default now(),
  constraint user_marbles_review_event_id_key unique (review_event_id),
  constraint user_marbles_user_id_slot_index_key unique (user_id, slot_index)
);

create index user_marbles_user_slot_idx
  on public.user_marbles (user_id, slot_index);

alter table public.user_marbles enable row level security;

create policy "Users can select their own marbles"
  on public.user_marbles
  for select
  to authenticated
  using (user_id = auth.uid());

revoke all on table public.user_marbles from public;
revoke all on table public.user_marbles from anon;
revoke insert, update, delete on table public.user_marbles from authenticated;
grant select on table public.user_marbles to authenticated;

create or replace function public.drop_discipline_marble()
returns table (
  id uuid,
  user_id uuid,
  review_event_id uuid,
  slot_index integer,
  x_position numeric,
  y_position numeric,
  rotation_degrees numeric,
  size_variant integer,
  color_variant integer,
  appearance_seed integer,
  dropped_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Keep this synchronized with DISCIPLINE_JAR_ELIGIBILITY_STARTS_AT in data/rewards.ts.
  v_eligibility_starts_at constant timestamptz := '2026-07-14 00:00:00+00'::timestamptz;
  v_user_id uuid := auth.uid();
  v_review_event_id uuid;
  v_slot_index integer;
  v_columns integer := 9;
  v_row integer;
  v_column integer;
  v_seed integer;
  v_x_jitter numeric;
  v_y_jitter numeric;
  v_x_position numeric(5,2);
  v_y_position numeric(5,2);
  v_rotation_degrees numeric(5,2);
  v_size_variant integer;
  v_color_variant integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );

  select review_event.id
    into v_review_event_id
  from public.review_events as review_event
  left join public.user_marbles as marble
    on marble.review_event_id = review_event.id
  where review_event.user_id = v_user_id
    and review_event.reviewed_at >= v_eligibility_starts_at
    and marble.id is null
  order by review_event.reviewed_at asc, review_event.id asc
  limit 1;

  if v_review_event_id is null then
    raise exception 'no_pending_marble' using errcode = 'P0001';
  end if;

  select pg_catalog.coalesce(pg_catalog.max(marble.slot_index), -1) + 1
    into v_slot_index
  from public.user_marbles as marble
  where marble.user_id = v_user_id;

  v_row := v_slot_index / v_columns;
  v_column := v_slot_index % v_columns;
  v_seed := pg_catalog.abs(
    (pg_catalog.hashtextextended(v_review_event_id::text, 17) % 2147483647)::integer
  );
  v_x_jitter := (((v_seed % 100)::numeric / 100) - 0.5) * 2;
  v_y_jitter := ((((v_seed / 100) % 100)::numeric / 100) - 0.5) * 1.4;
  v_x_position := pg_catalog.round(
    pg_catalog.least(
      92::numeric,
      pg_catalog.greatest(
        8::numeric,
        10::numeric + (v_column::numeric * 10::numeric) + v_x_jitter
      )
    ),
    2
  );
  v_y_position := pg_catalog.round(
    pg_catalog.least(
      92::numeric,
      pg_catalog.greatest(
        8::numeric,
        88::numeric - (v_row::numeric * 5.5) + v_y_jitter
      )
    ),
    2
  );
  v_rotation_degrees := (((v_seed / 10000) % 61) - 30)::numeric;
  v_size_variant := (v_seed / 100000) % 3;
  v_color_variant := (v_seed / 300000) % 6;

  return query
  insert into public.user_marbles (
    user_id,
    review_event_id,
    slot_index,
    x_position,
    y_position,
    rotation_degrees,
    size_variant,
    color_variant,
    appearance_seed
  )
  values (
    v_user_id,
    v_review_event_id,
    v_slot_index,
    v_x_position,
    v_y_position,
    v_rotation_degrees,
    v_size_variant,
    v_color_variant,
    v_seed
  )
  returning
    user_marbles.id,
    user_marbles.user_id,
    user_marbles.review_event_id,
    user_marbles.slot_index,
    user_marbles.x_position,
    user_marbles.y_position,
    user_marbles.rotation_degrees,
    user_marbles.size_variant,
    user_marbles.color_variant,
    user_marbles.appearance_seed,
    user_marbles.dropped_at;
end;
$$;

revoke execute on function public.drop_discipline_marble() from public;
revoke execute on function public.drop_discipline_marble() from anon;
grant execute on function public.drop_discipline_marble() to authenticated;
