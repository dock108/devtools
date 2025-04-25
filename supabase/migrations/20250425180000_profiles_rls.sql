-- Apply RLS to profiles table

-- 1. Enable RLS
alter table public.profiles enable row level security;

-- 2. Create policy for users to read/write their own profile
create policy "Users can manage their own profile." 
  on public.profiles
  for all -- Allows SELECT, INSERT, UPDATE, DELETE
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 3. (Optional but recommended) Allow service_role to bypass RLS
create policy "Allow service_role access"
  on public.profiles
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role'); 