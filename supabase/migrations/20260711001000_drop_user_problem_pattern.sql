drop function if exists public.create_user_problem(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  date
);

alter table public.user_problems
  drop column pattern;
