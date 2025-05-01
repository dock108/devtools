-- Wait-list sign-ups (no auth required)
create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  referrer    text,
  created_at  timestamptz default current_timestamp
);

-- Authenticated users & plan tiers
create table public.users (
  id         uuid primary key default gen_random_uuid(),
  auth_uid   uuid references auth.users(id) on delete cascade,
  tier       text not null default 'free_beta',
  created_at timestamptz default current_timestamp
);

-- Cron job metadata stub
create table public.jobs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users(id) on delete cascade,
  name       text not null,
  cron       text not null,
  script_url text not null,
  active     boolean default true,
  last_run   timestamptz
);

-- Row-level security policies
alter table public.jobs enable row level security;

-- Drop existing policy if it exists
drop policy if exists "Users can manage their own jobs" on public.jobs;

-- Create updated policy that joins with users table to check auth_uid
create policy "Users can manage their own jobs"
  on public.jobs
  for all
  using (
    user_id in (
      select id from public.users
      where auth_uid = auth.uid()
    )
  ); 