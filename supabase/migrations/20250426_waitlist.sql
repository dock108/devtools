create table public.waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamptz default now()
);

alter table public.waitlist enable row level security;
create policy "Public inserts" on public.waitlist
  for insert using (true) with check (true); 