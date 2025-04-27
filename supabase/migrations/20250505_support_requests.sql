create table support_requests (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  message text not null,
  created_at timestamptz default now()
);

alter table support_requests enable row level security;

-- Users (anonymous or logged-in) can insert
create policy "Public insert" on support_requests
  for insert with check (true);

-- Only admin role can select
create policy "Admin read" on support_requests
  for select using (auth.role() = 'admin'); 