-- Schema definition for guardian_leads table

-- Create the table if it doesn't exist
create table if not exists public.guardian_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz default now() not null
);

-- Enable Row Level Security (RLS)
alter table public.guardian_leads enable row level security;

-- Drop existing policies if they exist to avoid errors on re-run
drop policy if exists "Allow public insert access" on public.guardian_leads;
drop policy if exists "Allow public select access" on public.guardian_leads;

-- Create policy allowing public insert access
create policy "Allow public insert access"
  on public.guardian_leads for insert
  with check (true);

-- Optional: Create policy allowing public read access (if needed later)
-- create policy "Allow public select access"
--   on public.guardian_leads for select
--   using (true);

-- Grant usage on the schema to the anon role
-- grant usage on schema public to anon;
-- Grant insert permissions on the table to the anon role
-- grant insert on table public.guardian_leads to anon;
-- Optional: Grant select permissions if read access policy is enabled
-- grant select on table public.guardian_leads to anon; 