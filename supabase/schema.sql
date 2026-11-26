-- ============================================================
-- FocusFlow - Supabase schema (Postgres + row level security)
-- Run this once in Supabase -> SQL Editor -> New query.
-- Every table is scoped to auth.uid(), so one user can never
-- read or write another user's rows, even via the public API.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- profile ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text,
  plan text not null default 'free' check (plan in ('free', 'plus', 'pro', 'premium')),
  daily_goal integer not null default 120,
  theme text not null default 'system',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are private to their owner" on public.profiles;
create policy "profiles are private to their owner"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
-- A signed-in user can edit their profile, but must never be able to
-- grant themselves a paid plan. Only the service role (your payment
-- webhook) may change the plan column.
create or replace function public.guard_plan()
returns trigger
language plpgsql
as $$
begin
  -- On insert, a client may only create a free profile. The signup
  -- trigger and the payment webhook (service role) are the exceptions.
  if tg_op = 'INSERT' then
    if new.plan <> 'free'
       and coalesce(auth.role(), '') <> 'service_role'
       and current_user not in ('postgres', 'supabase_admin') then
      new.plan := 'free';
    end if;
    return new;
  end if;

  if new.plan is distinct from old.plan
     and coalesce(auth.role(), '') <> 'service_role'
     and current_user not in ('postgres', 'supabase_admin') then
    new.plan := old.plan;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_plan on public.profiles;
create trigger guard_profile_plan
  before insert or update on public.profiles
  for each row execute function public.guard_plan();

-- ---------- tasks ----------
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  minutes integer not null default 25 check (minutes between 2 and 180),
  energy text not null default 'focus' check (energy in ('easy', 'focus', 'deep')),
  status text not null default 'planned' check (status in ('planned', 'active', 'done')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists tasks_user_created on public.tasks (user_id, created_at desc);
create index if not exists tasks_user_status on public.tasks (user_id, status);

alter table public.tasks enable row level security;

drop policy if exists "tasks belong to one user" on public.tasks;
create policy "tasks belong to one user"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- focus sessions ----------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  minutes integer not null check (minutes between 2 and 180),
  mode text not null default 'focus',
  started_at timestamptz not null default now(),
  day date not null default current_date
);

create index if not exists sessions_user_day on public.sessions (user_id, day desc);

alter table public.sessions enable row level security;

drop policy if exists "sessions belong to one user" on public.sessions;
create policy "sessions belong to one user"
  on public.sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- daily record ----------
create table if not exists public.days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  focus_minutes integer not null default 0,
  session_count integer not null default 0,
  note text check (char_length(note) <= 280),
  primary key (user_id, day)
);

alter table public.days enable row level security;

drop policy if exists "days belong to one user" on public.days;
create policy "days belong to one user"
  on public.days for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- goals ----------
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  horizon text not null default 'weekly' check (horizon in ('daily', 'weekly', 'short-term', 'long-term')),
  why text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.goals enable row level security;

drop policy if exists "goals belong to one user" on public.goals;
create policy "goals belong to one user"
  on public.goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- brain dump ----------
create table if not exists public.dumps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 400),
  promoted boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.dumps enable row level security;

drop policy if exists "dumps belong to one user" on public.dumps;
create policy "dumps belong to one user"
  on public.dumps for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- new user -> profile row ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- API grants ----------
-- RLS decides which rows are visible; the signed-in role still needs
-- table privileges before PostgREST will evaluate those policies.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.tasks,
  public.sessions,
  public.days,
  public.goals,
  public.dumps
  to authenticated;