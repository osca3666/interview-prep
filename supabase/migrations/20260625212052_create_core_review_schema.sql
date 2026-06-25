create table public.user_problems (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  leetcode_slug text not null,
  leetcode_url text not null,
  title text not null,
  difficulty text not null,
  pattern text,
  notes text not null default '',
  lifecycle_state text not null default 'active',
  review_stage integer not null default 0,
  last_reviewed_at timestamptz,
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_problems_difficulty_check
    check (difficulty in ('easy', 'medium', 'hard')),
  constraint user_problems_lifecycle_state_check
    check (lifecycle_state in ('active', 'paused', 'archived')),
  constraint user_problems_review_stage_check
    check (review_stage >= 0),
  constraint user_problems_user_id_leetcode_slug_key
    unique (user_id, leetcode_slug),
  constraint user_problems_id_user_id_key
    unique (id, user_id)
);

create table public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_problem_id uuid not null,
  rating text not null,
  previous_review_stage integer not null,
  new_review_stage integer not null,
  previous_next_review_at timestamptz,
  next_review_at timestamptz not null,
  reviewed_at timestamptz not null default now(),
  constraint review_events_rating_check
    check (rating in ('again', 'hard', 'good', 'easy')),
  constraint review_events_previous_review_stage_check
    check (previous_review_stage >= 0),
  constraint review_events_new_review_stage_check
    check (new_review_stage >= 0),
  constraint review_events_user_problem_user_fk
    foreign key (user_problem_id, user_id)
    references public.user_problems (id, user_id)
    on delete cascade
);

create index user_problems_active_due_idx
  on public.user_problems (user_id, next_review_at)
  where lifecycle_state = 'active';

create index review_events_problem_history_idx
  on public.review_events (user_problem_id, reviewed_at desc);

alter table public.user_problems enable row level security;
alter table public.review_events enable row level security;

create policy "Users can select their own problems"
  on public.user_problems
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own problems"
  on public.user_problems
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "Users can update their own problems"
  on public.user_problems
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can delete their own problems"
  on public.user_problems
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "Users can select their own review events"
  on public.review_events
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own review events"
  on public.review_events
  for insert
  to authenticated
  with check (user_id = auth.uid());
